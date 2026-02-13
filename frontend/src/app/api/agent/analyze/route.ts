import Anthropic from "@anthropic-ai/sdk";
import { agentTools, AGENT_SYSTEM_PROMPT } from "@/lib/agent-tools";
import {
  fetchCryptoPrices,
  fetchForexRates,
  fetchCommodityPrices,
  fetchMentoRates,
  fetchCeloDefiYields,
} from "@/lib/market-data";
import { getMentoOnChainRates, buildSwapTx, type MentoToken, TOKENS, MIN_PROFITABLE_SPREAD_PCT } from "@/lib/mento-sdk";
import { addSignal } from "@/lib/signal-store";
import { addTrade, updateTrade } from "@/lib/trade-store";
import type { Signal, Trade, MarketType, SignalDirection, SignalTier } from "@/lib/types";
import { createWalletClient, http, type Hash } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { getAttestation, getTeeHeaders } from "@/lib/tee";
import { commitDecision, isAgentPaused, checkVolumeLimit, recordVolume, getAgentStatus, checkGasThreshold } from "@/lib/agent-policy";
import { apiError } from "@/lib/api-errors";

export const maxDuration = 60;

// Rate limit: 1 request per 30 seconds per IP
const ipCooldowns = new Map<string, number>();
const COOLDOWN_MS = 30_000;

function verifyAuth(request: Request): { ok: boolean; via: "bearer" | "ratelimit" | "denied" } {
  // Bearer token — server-to-server / cron calls
  const secret = process.env.AGENT_API_SECRET;
  const auth = request.headers.get("authorization");
  if (secret && auth === `Bearer ${secret}`) {
    return { ok: true, via: "bearer" };
  }

  // Browser calls — rate-limited by IP
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const last = ipCooldowns.get(ip) ?? 0;
  if (now - last < COOLDOWN_MS) {
    return { ok: false, via: "denied" };
  }
  ipCooldowns.set(ip, now);

  // Cleanup old entries every ~50 requests
  if (ipCooldowns.size > 50) {
    for (const [k, v] of ipCooldowns) {
      if (now - v > COOLDOWN_MS * 10) ipCooldowns.delete(k);
    }
  }

  return { ok: true, via: "ratelimit" };
}

export async function POST(request: Request) {
  // Circuit breaker — emergency pause
  if (isAgentPaused()) {
    const status = getAgentStatus();
    return new Response(
      JSON.stringify(apiError("AGENT_PAUSED", "Agent is paused (circuit breaker active)", status)),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const auth = verifyAuth(request);
  if (!auth.ok) {
    return new Response(
      JSON.stringify(apiError("RATE_LIMITED", "Rate limited — wait 30 seconds", { retryAfterSeconds: 30 })),
      { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "30" } }
    );
  }

  // Parse optional cash flows from request body
  let cashFlows: Array<{ token: string; amount: number; date: string; note: string }> = [];
  try {
    const body = await request.json().catch(() => ({}));
    if (Array.isArray(body?.cashFlows)) cashFlows = body.cashFlows;
  } catch { /* no body */ }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "API key not configured. Set ANTHROPIC_API_KEY in environment." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      }

      const teeAttestation = await getAttestation();
      send("tee_status", {
        status: teeAttestation.status,
        verified: teeAttestation.verified,
        provider: "Phala Cloud",
      });

      const client = new Anthropic({ apiKey });
      let signalCount = 0;
      const swapTxs: Array<{ fromToken: string; toToken: string; amount: string; rate: number; expectedOut: string }> = [];
      const toolCallLog: Array<{ tool: string; summary: string }> = [];
      const allSignals: Signal[] = [];

      try {
        const messages: Anthropic.MessageParam[] = [
          {
            role: "user",
            content:
              "Analyze markets with a focus on FX opportunities. Fetch Mento on-chain rates first, then forex, crypto, and commodities. Compare Mento stablecoin rates against real forex rates to find swap opportunities. Generate 3-5 signals — prioritize Mento FX actions where spreads are favorable.",
          },
        ];

        let iterations = 0;
        const MAX_ITERATIONS = 10;

        while (iterations < MAX_ITERATIONS) {
          iterations++;
          send("iteration", { iteration: iterations });

          const response = await client.messages.create({
            model: "claude-sonnet-4-5-20250929",
            max_tokens: 4096,
            system: AGENT_SYSTEM_PROMPT,
            tools: agentTools,
            messages,
          });

          const toolUseBlocks = response.content.filter(
            (block): block is Anthropic.ContentBlock & { type: "tool_use" } =>
              block.type === "tool_use"
          );

          if (toolUseBlocks.length === 0) break;

          messages.push({ role: "assistant", content: response.content });

          const toolResults: Anthropic.ToolResultBlockParam[] = [];

          for (const toolUse of toolUseBlocks) {
            let result: string;

            switch (toolUse.name) {
              case "fetch_crypto": {
                const data = await fetchCryptoPrices();
                result = JSON.stringify(data);
                const top = data.slice(0, 3).map((d: { symbol: string; price: number }) => `${d.symbol} $${d.price.toLocaleString()}`).join(", ");
                const entry = { tool: "fetch_crypto", summary: top || "Fetched crypto prices" };
                toolCallLog.push(entry);
                send("tool_call", entry);
                break;
              }
              case "fetch_forex": {
                const data = await fetchForexRates();
                result = JSON.stringify(data);
                const top = data.slice(0, 3).map((d: { symbol: string; price: number }) => `${d.symbol} ${d.price}`).join(", ");
                const entry = { tool: "fetch_forex", summary: top || "Fetched forex rates" };
                toolCallLog.push(entry);
                send("tool_call", entry);
                break;
              }
              case "fetch_commodities": {
                const data = await fetchCommodityPrices();
                result = JSON.stringify(data);
                const top = data.slice(0, 2).map((d: { symbol: string; price: number }) => `${d.symbol} $${d.price.toLocaleString()}`).join(", ");
                const entry = { tool: "fetch_commodities", summary: top || "Fetched commodity prices" };
                toolCallLog.push(entry);
                send("tool_call", entry);
                break;
              }
              case "fetch_mento_rates": {
                try {
                  const onChainData = await getMentoOnChainRates();
                  if (onChainData.length > 0) {
                    result = JSON.stringify(onChainData);
                    const entry = { tool: "fetch_mento_rates", summary: `${onChainData.length} pairs from Broker (on-chain)` };
                    toolCallLog.push(entry);
                    send("tool_call", entry);
                    break;
                  }
                } catch {
                  // Fall through to CoinGecko fallback
                }
                const data = await fetchMentoRates();
                result = JSON.stringify(data);
                const entry = { tool: "fetch_mento_rates", summary: `${data.length} Mento pairs (CoinGecko)` };
                toolCallLog.push(entry);
                send("tool_call", entry);
                break;
              }
              case "fetch_cross_venue_rates": {
                try {
                  const { getCrossVenueRates } = await import("@/lib/uniswap-quotes");
                  const crossVenueData = await getCrossVenueRates();
                  result = JSON.stringify(crossVenueData);
                  const cvEntry = { tool: "fetch_cross_venue_rates", summary: `${crossVenueData.length} cross-venue pairs (Mento vs Uniswap V3)` };
                  toolCallLog.push(cvEntry);
                  send("tool_call", cvEntry);
                } catch (e) {
                  result = JSON.stringify({ error: "Failed to fetch cross-venue rates", details: e instanceof Error ? e.message : "unknown" });
                  const cvEntry = { tool: "fetch_cross_venue_rates", summary: "Cross-venue fetch failed" };
                  toolCallLog.push(cvEntry);
                  send("tool_call", cvEntry);
                }
                break;
              }
              case "generate_fx_action": {
                const input = toolUse.input as Record<string, unknown>;
                const signal: Signal = {
                  id: `agent-fx-${Date.now()}-${signalCount}`,
                  market: "mento" as MarketType,
                  asset: `${input.fromToken}/${input.toToken}`,
                  direction: "long" as SignalDirection,
                  confidence: input.confidence as number,
                  summary: `Swap ${input.fromToken} → ${input.toToken} via Mento${input.spreadPct ? ` (${input.spreadPct}% spread)` : ""}`,
                  reasoning: input.reasoning as string | undefined,
                  entryPrice: input.mentoRate as number | undefined,
                  targetPrice: input.forexRate as number | undefined,
                  tier: (input.tier as SignalTier) || "free",
                  timestamp: Date.now(),
                };
                addSignal(signal);
                allSignals.push(signal);
                signalCount++;
                result = JSON.stringify({
                  success: true,
                  signalId: signal.id,
                  message: `FX action: SWAP ${input.fromToken} → ${input.toToken} (${signal.confidence}% confidence)`,
                });
                const tcEntry = { tool: "generate_fx_action", summary: `${input.fromToken}→${input.toToken} ${input.spreadPct || ""}% spread` };
                toolCallLog.push(tcEntry);
                send("tool_call", tcEntry);
                send("signal", { asset: signal.asset, direction: signal.direction, confidence: signal.confidence });
                break;
              }
              case "generate_signal": {
                const input = toolUse.input as Record<string, unknown>;
                const signal: Signal = {
                  id: `agent-${Date.now()}-${signalCount}`,
                  market: input.market as MarketType,
                  asset: input.asset as string,
                  direction: input.direction as SignalDirection,
                  confidence: input.confidence as number,
                  summary: input.summary as string,
                  reasoning: input.reasoning as string | undefined,
                  entryPrice: input.entryPrice as number | undefined,
                  targetPrice: input.targetPrice as number | undefined,
                  stopLoss: input.stopLoss as number | undefined,
                  tier: (input.tier as SignalTier) || "free",
                  timestamp: Date.now(),
                };
                addSignal(signal);
                allSignals.push(signal);
                signalCount++;
                result = JSON.stringify({
                  success: true,
                  signalId: signal.id,
                  message: `Signal generated: ${signal.direction.toUpperCase()} ${signal.asset} (${signal.confidence}% confidence)`,
                });
                const tcEntry = { tool: "generate_signal", summary: `${signal.direction.toUpperCase()} ${signal.asset} ${signal.confidence}%` };
                toolCallLog.push(tcEntry);
                send("tool_call", tcEntry);
                send("signal", { asset: signal.asset, direction: signal.direction, confidence: signal.confidence });
                break;
              }
              case "check_pending_orders": {
                const { getOrders: fetchOrders, updateOrder: patchOrder } = await import("@/lib/order-store");
                const { getOnChainQuote } = await import("@/lib/mento-sdk");

                const pendingOrders = fetchOrders({ status: "pending" });
                const now = Date.now();
                const orderAnalysis: Array<Record<string, unknown>> = [];
                let expired = 0;

                // Fetch forex rates once for all orders
                const forexRes = await fetch(
                  "https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,BRL",
                  { signal: AbortSignal.timeout(5000) }
                ).then(r => r.json()).catch(() => ({ rates: { EUR: 0.926, BRL: 5.7 } }));
                const forexMap: Record<string, number> = {
                  "cUSD/cEUR": forexRes.rates?.EUR ?? 0.926,
                  "cUSD/cREAL": forexRes.rates?.BRL ?? 5.7,
                  "cEUR/cUSD": 1 / (forexRes.rates?.EUR ?? 0.926),
                  "cREAL/cUSD": 1 / (forexRes.rates?.BRL ?? 5.7),
                };

                for (const order of pendingOrders) {
                  // Expired?
                  if (now > order.deadline) {
                    patchOrder(order.id, { status: "expired", lastCheckedAt: now, checksCount: (order.checksCount || 0) + 1 });
                    expired++;
                    send("order_check", { orderId: order.id, decision: "expired", pair: `${order.fromToken}/${order.toToken}` });
                    continue;
                  }

                  // Get fresh on-chain quote
                  try {
                    const quote = await getOnChainQuote(
                      order.fromToken as MentoToken,
                      order.toToken as MentoToken,
                      "1"
                    );

                    // Append to rateHistory (cap at 20)
                    const history = [...(order.rateHistory || []), { rate: quote.rate, timestamp: now }].slice(-20);
                    patchOrder(order.id, {
                      lastCheckedAt: now,
                      checksCount: (order.checksCount || 0) + 1,
                      rateHistory: history,
                    });

                    // Compute momentum from last 3 data points
                    let momentum: "improving" | "stable" | "declining" = "stable";
                    if (history.length >= 3) {
                      const recent = history.slice(-3);
                      const delta = recent[2].rate - recent[0].rate;
                      const noiseThreshold = order.targetRate * 0.0005; // 0.05% of target
                      if (delta > noiseThreshold) momentum = "improving";
                      else if (delta < -noiseThreshold) momentum = "declining";
                    }

                    // Compute volatility from rate history (std dev of % changes)
                    let volatility: "low" | "medium" | "high" = "low";
                    if (history.length >= 4) {
                      const pctChanges: number[] = [];
                      for (let i = 1; i < history.length; i++) {
                        pctChanges.push(((history[i].rate - history[i - 1].rate) / history[i - 1].rate) * 100);
                      }
                      const mean = pctChanges.reduce((a, b) => a + b, 0) / pctChanges.length;
                      const variance = pctChanges.reduce((sum, v) => sum + (v - mean) ** 2, 0) / pctChanges.length;
                      const stdDev = Math.sqrt(variance);
                      if (stdDev > 0.15) volatility = "high";
                      else if (stdDev > 0.05) volatility = "medium";
                    }

                    // Compute urgency
                    const hoursLeft = (order.deadline - now) / 3_600_000;
                    let urgency: "low" | "medium" | "high" = "low";
                    if (hoursLeft < 2) urgency = "high";
                    else if (hoursLeft < 12) urgency = "medium";

                    // Rate gap vs target
                    const rateGapPct = ((quote.rate - order.targetRate) / order.targetRate) * 100;

                    // Spread vs real forex
                    const pair = `${order.fromToken}/${order.toToken}`;
                    const forexRate = forexMap[pair];
                    const spreadVsForexPct = forexRate
                      ? ((quote.rate - forexRate) / forexRate) * 100
                      : null;

                    // Forex trend signal: is forex moving toward or away from order's target?
                    let forexSignal: "favorable" | "neutral" | "unfavorable" = "neutral";
                    if (forexRate) {
                      const forexGap = ((forexRate - order.targetRate) / order.targetRate) * 100;
                      // If forex is already above target, trend is favorable (Mento follows forex)
                      if (forexGap > 0.3) forexSignal = "favorable";
                      else if (forexGap < -0.5) forexSignal = "unfavorable";
                    }

                    // ── Condition-type-aware evaluation ──
                    const conditionType = order.conditionType || "rate_reaches";
                    let conditionMet = false;
                    let conditionLabel = "";

                    switch (conditionType) {
                      case "rate_reaches":
                        conditionMet = quote.rate >= order.targetRate;
                        conditionLabel = `rate ${quote.rate.toFixed(4)} ${conditionMet ? ">=" : "<"} target ${order.targetRate}`;
                        break;
                      case "pct_change": {
                        const refRate = order.referenceRate || (history[0]?.rate ?? quote.rate);
                        const pctChange = ((quote.rate - refRate) / refRate) * 100;
                        const threshold = order.pctChangeThreshold || 5;
                        conditionMet = Math.abs(pctChange) >= threshold;
                        conditionLabel = `${pctChange.toFixed(2)}% change (threshold: ±${threshold}%)`;
                        break;
                      }
                      case "rate_crosses_above": {
                        const prevRate = history.length >= 2 ? history[history.length - 2].rate : (order.referenceRate ?? 0);
                        conditionMet = prevRate < order.targetRate && quote.rate >= order.targetRate;
                        conditionLabel = `prev ${prevRate.toFixed(4)} → now ${quote.rate.toFixed(4)} (cross above ${order.targetRate})`;
                        break;
                      }
                      case "rate_crosses_below": {
                        const prevRate = history.length >= 2 ? history[history.length - 2].rate : (order.referenceRate ?? Infinity);
                        conditionMet = prevRate >= order.targetRate && quote.rate < order.targetRate;
                        conditionLabel = `prev ${prevRate.toFixed(4)} → now ${quote.rate.toFixed(4)} (cross below ${order.targetRate})`;
                        break;
                      }
                    }

                    orderAnalysis.push({
                      orderId: order.id,
                      pair,
                      amountIn: order.amountIn,
                      currentRate: quote.rate,
                      targetRate: order.targetRate,
                      rateGapPct: Number(rateGapPct.toFixed(3)),
                      meetsTarget: conditionMet,
                      conditionType,
                      conditionLabel,
                      momentum,
                      volatility,
                      urgency,
                      hoursLeft: Number(hoursLeft.toFixed(1)),
                      forexRate: forexRate ? Number(forexRate.toFixed(6)) : null,
                      spreadVsForexPct: spreadVsForexPct !== null ? Number(spreadVsForexPct.toFixed(3)) : null,
                      forexSignal,
                      rateHistory: history.slice(-5).map(h => ({ rate: h.rate, ago: `${((now - h.timestamp) / 3_600_000).toFixed(1)}h` })),
                      checksCount: (order.checksCount || 0) + 1,
                    });

                    send("order_check", {
                      orderId: order.id,
                      decision: "analyzed",
                      currentRate: quote.rate,
                      targetRate: order.targetRate,
                      momentum,
                      volatility,
                      urgency,
                      forexSignal,
                      pair,
                    });
                  } catch {
                    patchOrder(order.id, { lastCheckedAt: now, checksCount: (order.checksCount || 0) + 1 });
                    orderAnalysis.push({
                      orderId: order.id,
                      pair: `${order.fromToken}/${order.toToken}`,
                      error: "Failed to fetch on-chain quote",
                    });
                  }
                }

                const tcEntry = {
                  tool: "check_pending_orders",
                  summary: `${orderAnalysis.length} analyzed, ${expired} expired — awaiting your execute_order calls`,
                };
                toolCallLog.push(tcEntry);
                send("tool_call", tcEntry);

                result = JSON.stringify({
                  orders: orderAnalysis,
                  expired,
                  instructions: orderAnalysis.length > 0
                    ? "Review each order's momentum, volatility, urgency, forexSignal, and spreadVsForexPct. Call execute_order for each order you decide to fill, with detailed reasoning."
                    : "No pending orders to evaluate.",
                });
                break;
              }
              case "execute_order": {
                const input = toolUse.input as Record<string, unknown>;
                const orderId = input.orderId as string;
                const reasoning = input.reasoning as string;

                const { getOrder: fetchOrder, updateOrder: patchOrder } = await import("@/lib/order-store");
                const { getOnChainQuote } = await import("@/lib/mento-sdk");

                const order = fetchOrder(orderId);
                if (!order || order.status !== "pending") {
                  const tcEntry = { tool: "execute_order", summary: `${orderId} — not found or not pending` };
                  toolCallLog.push(tcEntry);
                  send("tool_call", tcEntry);
                  result = JSON.stringify({ error: `Order ${orderId} not found or not in pending status` });
                  break;
                }

                const now = Date.now();

                // Check deadline
                if (now > order.deadline) {
                  patchOrder(orderId, { status: "expired", lastCheckedAt: now });
                  const tcEntry = { tool: "execute_order", summary: `${orderId} — expired` };
                  toolCallLog.push(tcEntry);
                  send("order_check", { orderId, decision: "expired", pair: `${order.fromToken}/${order.toToken}` });
                  result = JSON.stringify({ error: "Order has expired", orderId });
                  break;
                }

                // Fetch fresh on-chain quote
                let quote: { rate: number };
                try {
                  quote = await getOnChainQuote(
                    order.fromToken as MentoToken,
                    order.toToken as MentoToken,
                    "1"
                  );
                } catch {
                  const tcEntry = { tool: "execute_order", summary: `${orderId} — quote fetch failed` };
                  toolCallLog.push(tcEntry);
                  send("tool_call", tcEntry);
                  result = JSON.stringify({ error: "Failed to fetch on-chain quote", orderId });
                  break;
                }

                // Rate verification: must meet target, UNLESS urgent market order
                const hoursLeft = (order.deadline - now) / 3_600_000;
                const gapPct = ((quote.rate - order.targetRate) / order.targetRate) * 100;
                if (quote.rate < order.targetRate) {
                  const isUrgentMarketOrder = hoursLeft < 2 && Math.abs(gapPct) < 1;
                  if (!isUrgentMarketOrder) {
                    const tcEntry = { tool: "execute_order", summary: `${orderId} — rate ${quote.rate.toFixed(4)} below target ${order.targetRate}` };
                    toolCallLog.push(tcEntry);
                    send("tool_call", tcEntry);
                    result = JSON.stringify({
                      error: `Rate ${quote.rate.toFixed(4)} is below target ${order.targetRate} (gap: ${gapPct.toFixed(2)}%). Not urgent enough to fill at market.`,
                      orderId,
                      currentRate: quote.rate,
                      targetRate: order.targetRate,
                      gapPct: Number(gapPct.toFixed(3)),
                    });
                    break;
                  }
                }

                // Daily volume limit enforcement (policy: 500 cUSD / 24h)
                const amountUsd = parseFloat(order.amountIn);
                const volCheck = checkVolumeLimit(amountUsd);
                if (!volCheck.allowed) {
                  const tcEntry = { tool: "execute_order", summary: `${orderId} — BLOCKED by daily volume limit (${volCheck.currentVolume}/${volCheck.limit} cUSD)` };
                  toolCallLog.push(tcEntry);
                  send("tool_call", tcEntry);
                  result = JSON.stringify(apiError("VOLUME_LIMIT_EXCEEDED", `Daily volume limit reached (${volCheck.currentVolume}/${volCheck.limit} cUSD).`, { orderId, volumeStatus: volCheck }));
                  break;
                }

                // Commit decision hash BEFORE execution (auditability)
                const decisionHash = commitDecision({
                  orderId,
                  action: "execute",
                  reasoning,
                  timestamp: now,
                  currentRate: quote.rate,
                  targetRate: order.targetRate,
                  momentum: "n/a",
                  urgency: `${hoursLeft.toFixed(1)}h left`,
                });
                send("decision_hash", { orderId, hash: decisionHash, action: "execute" });

                // Execute swap
                try {
                  const swapResult = await buildSwapTx(
                    order.fromToken as MentoToken,
                    order.toToken as MentoToken,
                    order.amountIn
                  );

                  let txHash: string | undefined;
                  const privateKey = process.env.AGENT_PRIVATE_KEY;

                  if (privateKey) {
                    const normalizedKey = (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as `0x${string}`;
                    const account = privateKeyToAccount(normalizedKey);
                    const wallet = createWalletClient({
                      account,
                      chain: celo,
                      transport: http("https://forno.celo.org"),
                    });
                    const feeCurrency = TOKENS.cUSD as `0x${string}`;

                    const approvalHash = await wallet.sendTransaction({
                      to: TOKENS[order.fromToken as MentoToken],
                      data: swapResult.approvalTx.data as `0x${string}`,
                      feeCurrency,
                    });

                    const { createPublicClient } = await import("viem");
                    const publicClient = createPublicClient({
                      chain: celo,
                      transport: http("https://forno.celo.org"),
                    });
                    await publicClient.waitForTransactionReceipt({ hash: approvalHash });

                    const swapHash = await wallet.sendTransaction({
                      to: swapResult.swapTx.to,
                      data: swapResult.swapTx.data as `0x${string}`,
                      feeCurrency,
                    });
                    await publicClient.waitForTransactionReceipt({ hash: swapHash });
                    txHash = swapHash;
                  }

                  // Record volume after successful execution
                  recordVolume(amountUsd);

                  patchOrder(orderId, {
                    status: "executed",
                    executedAt: now,
                    executedRate: quote.rate,
                    executedTxHash: txHash,
                    agentReasoning: reasoning,
                    lastCheckedAt: now,
                  });

                  const orderTrade: Trade = {
                    id: `trade-order-${orderId}-${now}`,
                    pair: `${order.fromToken}/${order.toToken}`,
                    fromToken: order.fromToken,
                    toToken: order.toToken,
                    amountIn: order.amountIn,
                    amountOut: swapResult.summary.expectedOut,
                    rate: quote.rate,
                    spreadPct: 0,
                    status: txHash ? "confirmed" : "pending",
                    swapTxHash: txHash,
                    timestamp: now,
                  };
                  addTrade(orderTrade);

                  const tcEntry = {
                    tool: "execute_order",
                    summary: `${orderId} EXECUTED — ${order.amountIn} ${order.fromToken}→${order.toToken} @ ${quote.rate.toFixed(4)}`,
                  };
                  toolCallLog.push(tcEntry);
                  send("tool_call", tcEntry);
                  send("order_check", { orderId, decision: "executed", rate: quote.rate, pair: `${order.fromToken}/${order.toToken}` });

                  result = JSON.stringify({
                    success: true,
                    orderId,
                    executedRate: quote.rate,
                    amountIn: order.amountIn,
                    expectedOut: swapResult.summary.expectedOut,
                    txHash: txHash || "no-key",
                    decisionHash,
                    reasoning,
                  });
                } catch (err) {
                  const tcEntry = {
                    tool: "execute_order",
                    summary: `${orderId} — swap failed: ${err instanceof Error ? err.message : "unknown"}`,
                  };
                  toolCallLog.push(tcEntry);
                  send("tool_call", tcEntry);
                  result = JSON.stringify({
                    error: `Swap execution failed: ${err instanceof Error ? err.message : "unknown"}`,
                    orderId,
                  });
                }
                break;
              }
              case "check_portfolio_drift": {
                const { getPortfolioComposition, getTargetAllocation, DRIFT_THRESHOLD_PCT } = await import("@/lib/portfolio-config");
                try {
                  const composition = await getPortfolioComposition();
                  const allocation = getTargetAllocation();

                  // ── Cash flow analysis ──
                  // Summarize expected inflows within next 7 days per token
                  const now = Date.now();
                  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
                  const upcomingFlows: Record<string, number> = {};
                  const allFlows: Array<{ token: string; amount: number; daysUntil: number; note: string }> = [];
                  for (const flow of cashFlows) {
                    const flowDate = new Date(flow.date).getTime();
                    const daysUntil = Math.ceil((flowDate - now) / 86400000);
                    if (flowDate > now && flowDate - now <= SEVEN_DAYS) {
                      upcomingFlows[flow.token] = (upcomingFlows[flow.token] || 0) + flow.amount;
                    }
                    if (flowDate > now) {
                      allFlows.push({ token: flow.token, amount: flow.amount, daysUntil, note: flow.note });
                    }
                  }

                  let recommendations: Array<{ action: string; fromToken: string; toToken: string; amount: string; reason: string; priority: number }> = [];

                  if (composition.needsRebalance && composition.totalValueCusd > 5) {
                    // Sort by drift — generate recommendations for ALL drifted pairs
                    const sorted = [...composition.holdings].sort((a, b) => b.driftPct - a.driftPct);
                    const overweightTokens = sorted.filter(h => h.driftPct > DRIFT_THRESHOLD_PCT);
                    const underweightTokens = sorted.filter(h => h.driftPct < -DRIFT_THRESHOLD_PCT);

                    // Batch: pair each overweight with each underweight
                    for (const over of overweightTokens) {
                      for (const under of underweightTokens) {
                        // Calculate swap amount — cap at 50 cUSD or the smaller drift
                        const driftValue = Math.min(
                          Math.abs(over.driftPct / 100) * composition.totalValueCusd,
                          Math.abs(under.driftPct / 100) * composition.totalValueCusd,
                          50
                        );
                        let swapAmount = Math.max(0.1, Number(driftValue.toFixed(2)));

                        // ── Cash flow adjustment ──
                        // If underweight token has upcoming inflows, reduce urgency / amount
                        const expectedInflow = upcomingFlows[under.token] || 0;
                        let cashFlowNote = "";
                        if (expectedInflow > 0) {
                          const inflowCoversPct = (expectedInflow / composition.totalValueCusd) * 100;
                          if (inflowCoversPct >= Math.abs(under.driftPct) * 0.5) {
                            // Expected inflow covers >50% of the drift — reduce swap amount
                            swapAmount = Math.max(0.1, Number((swapAmount * 0.5).toFixed(2)));
                            cashFlowNote = ` Reduced by 50% — expected +${expectedInflow.toFixed(0)} ${under.token} inflow within 7 days covers part of the drift.`;
                          }
                        }
                        // If overweight token has upcoming inflows, increase priority
                        const overInflow = upcomingFlows[over.token] || 0;
                        let priority = Math.abs(over.driftPct) + Math.abs(under.driftPct);
                        if (overInflow > 0) {
                          priority += 5; // More urgent — more of this token coming
                          cashFlowNote += ` +${overInflow.toFixed(0)} ${over.token} expected soon — higher rebalance priority.`;
                        }

                        recommendations.push({
                          action: "rebalance_swap",
                          fromToken: over.token,
                          toToken: under.token,
                          amount: String(swapAmount),
                          reason: `${over.token} is +${over.driftPct.toFixed(1)}% overweight, ${under.token} is ${under.driftPct.toFixed(1)}% underweight. Swap ${swapAmount} ${over.token} value to ${under.token} to reduce drift.${cashFlowNote}`,
                          priority,
                        });
                      }
                    }

                    // Sort by priority (highest first) — agent executes in order
                    recommendations.sort((a, b) => b.priority - a.priority);
                  }

                  const tcEntry = {
                    tool: "check_portfolio_drift",
                    summary: composition.needsRebalance
                      ? `Drift ${composition.maxDriftPct.toFixed(1)}% — ${recommendations.length} rebalance swap(s)${Object.keys(upcomingFlows).length > 0 ? ` (cash flows factored)` : ""}`
                      : `Portfolio balanced (max drift ${composition.maxDriftPct.toFixed(1)}%)`,
                  };
                  toolCallLog.push(tcEntry);
                  send("tool_call", tcEntry);
                  send("portfolio_drift", {
                    maxDriftPct: composition.maxDriftPct,
                    needsRebalance: composition.needsRebalance,
                    holdings: composition.holdings.map(h => ({ token: h.token, actualPct: h.actualPct, targetPct: h.targetPct, driftPct: h.driftPct })),
                    cashFlows: allFlows.length > 0 ? allFlows : undefined,
                  });

                  result = JSON.stringify({
                    composition,
                    targetAllocation: allocation,
                    driftThreshold: DRIFT_THRESHOLD_PCT,
                    recommendations,
                    expectedCashFlows: allFlows.length > 0 ? allFlows : undefined,
                    upcomingInflowsSummary: Object.keys(upcomingFlows).length > 0
                      ? Object.entries(upcomingFlows).map(([t, a]) => `+${a.toFixed(0)} ${t} within 7d`).join(", ")
                      : "No expected inflows",
                    instructions: composition.needsRebalance
                      ? `Portfolio drift exceeds threshold. ${recommendations.length} rebalance swap(s) recommended (sorted by priority). Execute each using execute_mento_swap with spreadPct: 999 (rebalance bypass). Cash flows have been factored into amounts.`
                      : "Portfolio is balanced. No rebalancing needed.",
                  });
                } catch (err) {
                  const tcEntry = { tool: "check_portfolio_drift", summary: `Error: ${err instanceof Error ? err.message : "unknown"}` };
                  toolCallLog.push(tcEntry);
                  send("tool_call", tcEntry);
                  result = JSON.stringify({ error: err instanceof Error ? err.message : "Failed to check portfolio drift" });
                }
                break;
              }
              case "execute_mento_swap": {
                const input = toolUse.input as Record<string, unknown>;
                const tradeId = `trade-${Date.now()}-${signalCount}`;
                const fromToken = input.fromToken as MentoToken;
                const toToken = input.toToken as MentoToken;
                const amount = input.amount as string;
                const spreadPct = (input.spreadPct as number) || 0;

                // ── DAILY VOLUME LIMIT ──
                const swapAmountUsd = parseFloat(amount);
                const swapVolCheck = checkVolumeLimit(swapAmountUsd);
                if (!swapVolCheck.allowed) {
                  const tcEntry = {
                    tool: "execute_mento_swap",
                    summary: `${fromToken}→${toToken} BLOCKED — daily volume limit (${swapVolCheck.currentVolume}/${swapVolCheck.limit} cUSD)`,
                  };
                  toolCallLog.push(tcEntry);
                  send("tool_call", tcEntry);
                  result = JSON.stringify(apiError("VOLUME_LIMIT_EXCEEDED", `Daily volume limit reached. Used ${swapVolCheck.currentVolume} of ${swapVolCheck.limit} cUSD.`, { volumeStatus: swapVolCheck }));
                  break;
                }

                // ── REBALANCE DETECTION ──
                // spreadPct === 999 signals a portfolio rebalance trade — bypass profitability checks
                const isRebalanceTrade = spreadPct === 999;

                // ── PROFITABILITY GUARD (skip for rebalance trades) ──
                // Verify on-chain rate vs forex before executing. Protects vault depositors.
                if (!isRebalanceTrade && spreadPct < MIN_PROFITABLE_SPREAD_PCT) {
                  const tcEntry = {
                    tool: "execute_mento_swap",
                    summary: `${fromToken}→${toToken} BLOCKED — spread ${spreadPct.toFixed(2)}% below +${MIN_PROFITABLE_SPREAD_PCT}% threshold`,
                  };
                  toolCallLog.push(tcEntry);
                  send("tool_call", tcEntry);
                  result = JSON.stringify(apiError(
                    spreadPct < 0 ? "SPREAD_NEGATIVE" : "SPREAD_TOO_LOW",
                    `Swap rejected: spread ${spreadPct.toFixed(2)}% is below +${MIN_PROFITABLE_SPREAD_PCT}% threshold.`,
                    { spreadPct, threshold: MIN_PROFITABLE_SPREAD_PCT, reason: spreadPct < 0 ? "negative_spread" : "below_threshold" }
                  ));
                  break;
                }

                try {
                  // Double-check: fetch fresh on-chain rate to verify profitability (skip for rebalance trades)
                  const { getOnChainQuote } = await import("@/lib/mento-sdk");
                  const freshQuote = await getOnChainQuote(fromToken, toToken, "1");

                  if (!isRebalanceTrade) {
                  // Fetch forex for comparison
                  const forexCheck = await fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,BRL", { signal: AbortSignal.timeout(5000) })
                    .then(r => r.json())
                    .catch(() => ({ rates: { EUR: 0.926, BRL: 5.7 } }));

                  const forexRateMap: Record<string, number> = {
                    "cUSD/cEUR": forexCheck.rates?.EUR ?? 0.926,
                    "cUSD/cREAL": forexCheck.rates?.BRL ?? 5.7,
                    "cEUR/cUSD": 1 / (forexCheck.rates?.EUR ?? 0.926),
                    "cREAL/cUSD": 1 / (forexCheck.rates?.BRL ?? 5.7),
                  };
                  const pairKey = `${fromToken}/${toToken}`;
                  const expectedForex = forexRateMap[pairKey];

                  if (expectedForex) {
                    const realSpread = ((freshQuote.rate - expectedForex) / expectedForex) * 100;
                    if (realSpread < MIN_PROFITABLE_SPREAD_PCT) {
                      const tcEntry = {
                        tool: "execute_mento_swap",
                        summary: `${fromToken}→${toToken} BLOCKED — verified spread ${realSpread.toFixed(2)}% (on-chain check)`,
                      };
                      toolCallLog.push(tcEntry);
                      send("tool_call", tcEntry);
                      result = JSON.stringify({
                        error: `Swap rejected after on-chain verification: real spread is ${realSpread.toFixed(2)}% (Mento: ${freshQuote.rate.toFixed(6)}, Forex: ${expectedForex.toFixed(6)}). Need > +${MIN_PROFITABLE_SPREAD_PCT}% to be profitable. Vault capital protected.`,
                        verifiedSpread: realSpread,
                        mentoRate: freshQuote.rate,
                        forexRate: expectedForex,
                      });
                      break;
                    }
                  }
                  } // end if (!isRebalanceTrade)

                  // ── GAS THRESHOLD CHECK ──
                  if (!isRebalanceTrade) {
                    const expectedProfitUsd = (spreadPct / 100) * parseFloat(amount);
                    const gasCheck = await checkGasThreshold(expectedProfitUsd);
                    if (!gasCheck.safe) {
                      const tcEntry = {
                        tool: "execute_mento_swap",
                        summary: `${fromToken}→${toToken} BLOCKED — gas ${gasCheck.gasPriceGwei.toFixed(1)} gwei, cost $${gasCheck.estimatedGasCostUsd.toFixed(4)} > 50% of $${expectedProfitUsd.toFixed(4)} profit`,
                      };
                      toolCallLog.push(tcEntry);
                      send("tool_call", tcEntry);
                      result = JSON.stringify({
                        error: `Swap skipped: gas cost ($${gasCheck.estimatedGasCostUsd.toFixed(4)}) exceeds 50% of expected profit ($${expectedProfitUsd.toFixed(4)}). Gas: ${gasCheck.gasPriceGwei.toFixed(1)} gwei. Capital protected.`,
                        gasCheck,
                      });
                      break;
                    }
                  }

                  // Commit decision hash before execution (auditability)
                  const swapDecisionHash = commitDecision({
                    orderId: tradeId,
                    action: "execute",
                    reasoning: (input.reasoning as string) || `Mento swap ${fromToken}→${toToken} ${isRebalanceTrade ? "rebalance" : `spread ${spreadPct.toFixed(2)}%`}`,
                    timestamp: Date.now(),
                    currentRate: freshQuote.rate,
                    targetRate: 0,
                    momentum: "n/a",
                    urgency: "immediate",
                  });
                  send("decision_hash", { orderId: tradeId, hash: swapDecisionHash, action: "execute" });

                  const swapResult = await buildSwapTx(fromToken, toToken, amount);
                  swapTxs.push({
                    fromToken,
                    toToken,
                    amount,
                    rate: swapResult.summary.rate,
                    expectedOut: swapResult.summary.expectedOut,
                  });

                  const trade: Trade = {
                    id: tradeId,
                    pair: `${fromToken}/${toToken}`,
                    fromToken,
                    toToken,
                    amountIn: amount,
                    amountOut: swapResult.summary.expectedOut,
                    rate: swapResult.summary.rate,
                    spreadPct,
                    status: "pending",
                    timestamp: Date.now(),
                  };
                  addTrade(trade);

                  const privateKey = process.env.AGENT_PRIVATE_KEY;
                  let txStatus: "confirmed" | "pending" | "failed" = "pending";
                  let approvalHash: Hash | undefined;
                  let swapHash: Hash | undefined;

                  if (privateKey) {
                    try {
                      const normalizedKey = (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as `0x${string}`;
                      const account = privateKeyToAccount(normalizedKey);
                      const wallet = createWalletClient({
                        account,
                        chain: celo,
                        transport: http("https://forno.celo.org"),
                      });

                      // Fee abstraction: pay gas in cUSD instead of CELO (CIP-64)
                      const feeCurrency = TOKENS.cUSD as `0x${string}`;

                      approvalHash = await wallet.sendTransaction({
                        to: TOKENS[fromToken],
                        data: swapResult.approvalTx.data as `0x${string}`,
                        feeCurrency,
                      });

                      const { createPublicClient } = await import("viem");
                      const publicClient = createPublicClient({
                        chain: celo,
                        transport: http("https://forno.celo.org"),
                      });
                      await publicClient.waitForTransactionReceipt({ hash: approvalHash });

                      swapHash = await wallet.sendTransaction({
                        to: swapResult.swapTx.to,
                        data: swapResult.swapTx.data as `0x${string}`,
                        feeCurrency,
                      });

                      await publicClient.waitForTransactionReceipt({ hash: swapHash });
                      txStatus = "confirmed";
                    } catch (txErr) {
                      txStatus = "failed";
                      updateTrade(tradeId, {
                        status: "failed",
                        approvalTxHash: approvalHash,
                        error: `Tx failed: ${txErr instanceof Error ? txErr.message : "unknown"}`,
                      });
                    }
                  }

                  if (txStatus !== "failed") {
                    recordVolume(swapAmountUsd);
                    updateTrade(tradeId, {
                      status: txStatus,
                      approvalTxHash: approvalHash,
                      swapTxHash: swapHash,
                    });

                    // Track rebalance cost for hedging efficiency
                    if (isRebalanceTrade && txStatus === "confirmed") {
                      try {
                        const { addRebalance } = await import("@/lib/rebalance-store");
                        const { getPortfolioComposition } = await import("@/lib/portfolio-config");
                        const postComposition = await getPortfolioComposition();
                        // Estimate gas cost: ~250K gas * ~5 gwei * CELO price (~$0.50)
                        const estimatedGasCostUsd = 0.001; // negligible on Celo
                        addRebalance({
                          id: `rebal-${tradeId}`,
                          timestamp: Date.now(),
                          trades: [{ fromToken, toToken, amountIn: amount, amountOut: swapResult.summary.expectedOut, txHash: swapHash }],
                          driftBefore: spreadPct, // caller passes drift info via reasoning
                          driftAfter: postComposition.maxDriftPct,
                          totalCostUsd: estimatedGasCostUsd,
                          trigger: `drift rebalance`,
                        });
                      } catch { /* non-critical: don't fail the trade */ }
                    }
                  }

                  const signal: Signal = {
                    id: `agent-swap-${Date.now()}-${signalCount}`,
                    market: "mento" as MarketType,
                    asset: `${fromToken}/${toToken}`,
                    direction: "long" as SignalDirection,
                    confidence: 85,
                    summary: `Swap ${amount} ${fromToken} → ${swapResult.summary.expectedOut.slice(0, 8)} ${toToken} via Mento Broker`,
                    reasoning: input.reasoning as string,
                    entryPrice: swapResult.summary.rate,
                    tier: "premium" as SignalTier,
                    timestamp: Date.now(),
                  };
                  addSignal(signal);
                  allSignals.push(signal);
                  signalCount++;

                  const tcEntry = {
                    tool: "execute_mento_swap",
                    summary: `${amount} ${fromToken}→${toToken} ${txStatus === "confirmed" ? "CONFIRMED on-chain" : txStatus === "failed" ? "tx reverted" : "tx queued"}`,
                  };
                  toolCallLog.push(tcEntry);
                  send("tool_call", tcEntry);
                  send("signal", { asset: signal.asset, direction: signal.direction, confidence: signal.confidence });

                  result = JSON.stringify({
                    success: true,
                    signalId: signal.id,
                    tradeId,
                    swap: {
                      ...swapResult.summary,
                      brokerAddress: "0x777A8255cA72412f0d706dc03C9D1987306B4CaD",
                      status: txStatus === "confirmed" ? "executed" : txStatus === "pending" ? "tx_ready" : "failed",
                      approvalTxHash: approvalHash,
                      swapTxHash: swapHash,
                    },
                    teeAttestation,
                    message: txStatus === "confirmed"
                      ? `Swap executed on-chain: ${amount} ${fromToken} → ${swapResult.summary.expectedOut} ${toToken}`
                      : txStatus === "pending"
                        ? `Swap transaction built (no private key): ${amount} ${fromToken} → ${swapResult.summary.expectedOut} ${toToken}`
                        : `Swap failed: ${amount} ${fromToken} → ${toToken}`,
                  });
                } catch (err) {
                  addTrade({
                    id: tradeId,
                    pair: `${fromToken}/${toToken}`,
                    fromToken,
                    toToken,
                    amountIn: amount,
                    amountOut: "0",
                    rate: 0,
                    spreadPct,
                    status: "failed",
                    error: `Build failed: ${err instanceof Error ? err.message : "unknown error"}`,
                    timestamp: Date.now(),
                  });
                  const reason = err instanceof Error && err.message.includes("insufficient")
                    ? "insufficient balance"
                    : "spread below threshold";
                  const tcEntry = {
                    tool: "execute_mento_swap",
                    summary: `${amount} ${fromToken}→${toToken} skipped — ${reason}`,
                  };
                  toolCallLog.push(tcEntry);
                  send("tool_call", tcEntry);
                  result = JSON.stringify({
                    error: `Swap not executed: ${reason}`,
                    tradeId,
                  });
                }
                break;
              }
              case "execute_uniswap_swap": {
                const input = toolUse.input as Record<string, unknown>;
                const tradeId = `trade-uni-${Date.now()}-${signalCount}`;
                const fromToken = input.fromToken as string;
                const toToken = input.toToken as string;
                const amount = input.amount as string;
                const spreadPct = (input.spreadPct as number) || 0;

                // Safety checks
                const uniVolCheck = checkVolumeLimit(parseFloat(amount));
                if (!uniVolCheck.allowed) {
                  const tcEntry = { tool: "execute_uniswap_swap", summary: `${fromToken}→${toToken} BLOCKED — daily volume limit` };
                  toolCallLog.push(tcEntry);
                  send("tool_call", tcEntry);
                  result = JSON.stringify(apiError("VOLUME_LIMIT_EXCEEDED", `Daily volume limit reached (${uniVolCheck.currentVolume}/${uniVolCheck.limit} cUSD).`, { volumeStatus: uniVolCheck }));
                  break;
                }

                try {
                  const { buildUniswapSwapTx, UNI_TOKENS } = await import("@/lib/uniswap-quotes");
                  type UniToken = keyof typeof UNI_TOKENS;

                  const privateKey = process.env.AGENT_PRIVATE_KEY;
                  if (!privateKey) {
                    result = JSON.stringify(apiError("MISSING_PRIVATE_KEY", "No AGENT_PRIVATE_KEY configured"));
                    const tcEntry = { tool: "execute_uniswap_swap", summary: `${fromToken}→${toToken} — no private key` };
                    toolCallLog.push(tcEntry);
                    send("tool_call", tcEntry);
                    break;
                  }

                  const normalizedKey = (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as `0x${string}`;
                  const account = privateKeyToAccount(normalizedKey);

                  // Commit decision before execution
                  const decHash = commitDecision({
                    orderId: tradeId,
                    action: "execute",
                    reasoning: (input.reasoning as string) || `Uniswap swap ${fromToken}→${toToken}`,
                    timestamp: Date.now(),
                    currentRate: 0,
                    targetRate: 0,
                    momentum: "n/a",
                    urgency: "immediate",
                  });
                  send("decision_hash", { orderId: tradeId, hash: decHash, action: "execute" });

                  const swapResult = await buildUniswapSwapTx(
                    fromToken as UniToken,
                    toToken as UniToken,
                    amount,
                    account.address
                  );

                  const wallet = createWalletClient({
                    account,
                    chain: celo,
                    transport: http("https://forno.celo.org"),
                  });
                  const feeCurrency = TOKENS.cUSD as `0x${string}`;
                  const { createPublicClient: createPubClient } = await import("viem");
                  const publicClient = createPubClient({ chain: celo, transport: http("https://forno.celo.org") });

                  // Approve
                  const approvalHash = await wallet.sendTransaction({
                    to: swapResult.approvalTx.to,
                    data: swapResult.approvalTx.data as `0x${string}`,
                    feeCurrency,
                  });
                  await publicClient.waitForTransactionReceipt({ hash: approvalHash });

                  // Swap
                  const swapHash = await wallet.sendTransaction({
                    to: swapResult.swapTx.to,
                    data: swapResult.swapTx.data as `0x${string}`,
                    feeCurrency,
                  });
                  await publicClient.waitForTransactionReceipt({ hash: swapHash });

                  recordVolume(parseFloat(amount));

                  const trade: Trade = {
                    id: tradeId,
                    pair: `${fromToken}/${toToken}`,
                    fromToken,
                    toToken,
                    amountIn: amount,
                    amountOut: swapResult.summary.expectedOut,
                    rate: swapResult.summary.rate,
                    spreadPct,
                    status: "confirmed",
                    approvalTxHash: approvalHash,
                    swapTxHash: swapHash,
                    timestamp: Date.now(),
                  };
                  addTrade(trade);

                  const tcEntry = { tool: "execute_uniswap_swap", summary: `${amount} ${fromToken}→${toToken} CONFIRMED (Uniswap V3)` };
                  toolCallLog.push(tcEntry);
                  send("tool_call", tcEntry);

                  result = JSON.stringify({
                    success: true,
                    tradeId,
                    swap: swapResult.summary,
                    approvalTxHash: approvalHash,
                    swapTxHash: swapHash,
                    venue: "uniswap-v3",
                  });
                } catch (err) {
                  const tcEntry = { tool: "execute_uniswap_swap", summary: `${fromToken}→${toToken} FAILED: ${err instanceof Error ? err.message : "unknown"}` };
                  toolCallLog.push(tcEntry);
                  send("tool_call", tcEntry);
                  result = JSON.stringify({ error: `Uniswap swap failed: ${err instanceof Error ? err.message : "unknown"}`, tradeId });
                }
                break;
              }
              case "execute_cross_dex_arb": {
                const input = toolUse.input as Record<string, unknown>;
                const arbId = `arb-${Date.now()}`;
                const pair = input.pair as string;
                const amount = input.amount as string;
                const buyVenue = input.buyVenue as "mento" | "uniswap";
                const sellVenue = input.sellVenue as "mento" | "uniswap";
                const venueSpreadPct = input.venueSpreadPct as number;

                const arbVolCheck = checkVolumeLimit(parseFloat(amount));
                if (!arbVolCheck.allowed) {
                  const tcEntry = { tool: "execute_cross_dex_arb", summary: `${pair} BLOCKED — daily volume limit` };
                  toolCallLog.push(tcEntry);
                  send("tool_call", tcEntry);
                  result = JSON.stringify(apiError("VOLUME_LIMIT_EXCEEDED", "Daily volume limit reached.", { volumeStatus: arbVolCheck }));
                  break;
                }

                if (venueSpreadPct < 0.3) {
                  const tcEntry = { tool: "execute_cross_dex_arb", summary: `${pair} BLOCKED — venue spread ${venueSpreadPct}% < 0.3%` };
                  toolCallLog.push(tcEntry);
                  send("tool_call", tcEntry);
                  result = JSON.stringify(apiError("ARB_SPREAD_TOO_LOW", `Venue spread ${venueSpreadPct}% is below 0.3% threshold.`, { venueSpreadPct, threshold: 0.3 }));
                  break;
                }

                try {
                  const [tokenA, tokenB] = pair.split("/");
                  const privateKey = process.env.AGENT_PRIVATE_KEY;
                  if (!privateKey) {
                    result = JSON.stringify(apiError("MISSING_PRIVATE_KEY", "No AGENT_PRIVATE_KEY configured"));
                    const tcEntry = { tool: "execute_cross_dex_arb", summary: `${pair} — no private key` };
                    toolCallLog.push(tcEntry);
                    send("tool_call", tcEntry);
                    break;
                  }

                  const normalizedKey = (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as `0x${string}`;
                  const account = privateKeyToAccount(normalizedKey);

                  const decHash = commitDecision({
                    orderId: arbId,
                    action: "execute",
                    reasoning: (input.reasoning as string) || `Cross-DEX arb ${pair}: buy on ${buyVenue}, sell on ${sellVenue}`,
                    timestamp: Date.now(),
                    currentRate: 0,
                    targetRate: 0,
                    momentum: "n/a",
                    urgency: "immediate",
                  });
                  send("decision_hash", { orderId: arbId, hash: decHash, action: "execute" });

                  const wallet = createWalletClient({ account, chain: celo, transport: http("https://forno.celo.org") });
                  const feeCurrency = TOKENS.cUSD as `0x${string}`;
                  const { createPublicClient: createPubClient } = await import("viem");
                  const publicClient = createPubClient({ chain: celo, transport: http("https://forno.celo.org") });

                  let buyTxHash: string | undefined;
                  let sellTxHash: string | undefined;
                  let buyAmountOut = "0";
                  let sellAmountOut = "0";

                  // ── BUY LEG ──
                  if (buyVenue === "mento") {
                    const { buildSwapTx: buildMentoSwap } = await import("@/lib/mento-sdk");
                    const buyResult = await buildMentoSwap(tokenA as MentoToken, tokenB as MentoToken, amount);
                    const appHash = await wallet.sendTransaction({ to: buyResult.approvalTx.to, data: buyResult.approvalTx.data as `0x${string}`, feeCurrency });
                    await publicClient.waitForTransactionReceipt({ hash: appHash });
                    const swHash = await wallet.sendTransaction({ to: buyResult.swapTx.to, data: buyResult.swapTx.data as `0x${string}`, feeCurrency });
                    await publicClient.waitForTransactionReceipt({ hash: swHash });
                    buyTxHash = swHash;
                    buyAmountOut = buyResult.summary.expectedOut;
                  } else {
                    const { buildUniswapSwapTx, UNI_TOKENS } = await import("@/lib/uniswap-quotes");
                    type UniToken = keyof typeof UNI_TOKENS;
                    const buyResult = await buildUniswapSwapTx(tokenA as UniToken, tokenB as UniToken, amount, account.address);
                    const appHash = await wallet.sendTransaction({ to: buyResult.approvalTx.to, data: buyResult.approvalTx.data as `0x${string}`, feeCurrency });
                    await publicClient.waitForTransactionReceipt({ hash: appHash });
                    const swHash = await wallet.sendTransaction({ to: buyResult.swapTx.to, data: buyResult.swapTx.data as `0x${string}`, feeCurrency });
                    await publicClient.waitForTransactionReceipt({ hash: swHash });
                    buyTxHash = swHash;
                    buyAmountOut = buyResult.summary.expectedOut;
                  }

                  // ── SELL LEG ── (sell what we bought back to original token)
                  if (sellVenue === "mento") {
                    const { buildSwapTx: buildMentoSwap } = await import("@/lib/mento-sdk");
                    const sellResult = await buildMentoSwap(tokenB as MentoToken, tokenA as MentoToken, buyAmountOut);
                    const appHash = await wallet.sendTransaction({ to: sellResult.approvalTx.to, data: sellResult.approvalTx.data as `0x${string}`, feeCurrency });
                    await publicClient.waitForTransactionReceipt({ hash: appHash });
                    const swHash = await wallet.sendTransaction({ to: sellResult.swapTx.to, data: sellResult.swapTx.data as `0x${string}`, feeCurrency });
                    await publicClient.waitForTransactionReceipt({ hash: swHash });
                    sellTxHash = swHash;
                    sellAmountOut = sellResult.summary.expectedOut;
                  } else {
                    const { buildUniswapSwapTx, UNI_TOKENS } = await import("@/lib/uniswap-quotes");
                    type UniToken = keyof typeof UNI_TOKENS;
                    const sellResult = await buildUniswapSwapTx(tokenB as UniToken, tokenA as UniToken, buyAmountOut, account.address);
                    const appHash = await wallet.sendTransaction({ to: sellResult.approvalTx.to, data: sellResult.approvalTx.data as `0x${string}`, feeCurrency });
                    await publicClient.waitForTransactionReceipt({ hash: appHash });
                    const swHash = await wallet.sendTransaction({ to: sellResult.swapTx.to, data: sellResult.swapTx.data as `0x${string}`, feeCurrency });
                    await publicClient.waitForTransactionReceipt({ hash: swHash });
                    sellTxHash = swHash;
                    sellAmountOut = sellResult.summary.expectedOut;
                  }

                  const pnl = parseFloat(sellAmountOut) - parseFloat(amount);
                  recordVolume(parseFloat(amount));

                  const trade: Trade = {
                    id: arbId,
                    pair,
                    fromToken: tokenA,
                    toToken: tokenA,
                    amountIn: amount,
                    amountOut: sellAmountOut,
                    rate: parseFloat(sellAmountOut) / parseFloat(amount),
                    spreadPct: venueSpreadPct,
                    status: "confirmed",
                    swapTxHash: sellTxHash,
                    pnl,
                    timestamp: Date.now(),
                  };
                  addTrade(trade);

                  const tcEntry = { tool: "execute_cross_dex_arb", summary: `${pair} arb CONFIRMED — P&L: ${pnl >= 0 ? "+" : ""}${pnl.toFixed(4)} ${tokenA}` };
                  toolCallLog.push(tcEntry);
                  send("tool_call", tcEntry);

                  result = JSON.stringify({
                    success: true,
                    arbId,
                    buyLeg: { venue: buyVenue, txHash: buyTxHash, amountOut: buyAmountOut },
                    sellLeg: { venue: sellVenue, txHash: sellTxHash, amountOut: sellAmountOut },
                    pnl,
                    decisionHash: decHash,
                  });
                } catch (err) {
                  const tcEntry = { tool: "execute_cross_dex_arb", summary: `${pair} arb FAILED: ${err instanceof Error ? err.message : "unknown"}` };
                  toolCallLog.push(tcEntry);
                  send("tool_call", tcEntry);
                  result = JSON.stringify({ error: `Cross-DEX arb failed: ${err instanceof Error ? err.message : "unknown"}` });
                }
                break;
              }
              case "execute_remittance": {
                const input = toolUse.input as Record<string, unknown>;
                const remitId = `remit-${Date.now()}`;
                const fromToken = input.fromToken as MentoToken;
                const toToken = input.toToken as MentoToken;
                const amount = input.amount as string;
                const recipientAddress = input.recipientAddress as string;
                const corridor = input.corridor as string;

                // Validate address
                const { isAddress } = await import("viem");
                if (!isAddress(recipientAddress)) {
                  const tcEntry = { tool: "execute_remittance", summary: `BLOCKED — invalid recipient address` };
                  toolCallLog.push(tcEntry);
                  send("tool_call", tcEntry);
                  result = JSON.stringify(apiError("INVALID_ADDRESS", `Invalid recipient address: ${recipientAddress}`, { recipientAddress }));
                  break;
                }

                const remitVolCheck = checkVolumeLimit(parseFloat(amount));
                if (!remitVolCheck.allowed) {
                  const tcEntry = { tool: "execute_remittance", summary: `${corridor} BLOCKED — daily volume limit` };
                  toolCallLog.push(tcEntry);
                  send("tool_call", tcEntry);
                  result = JSON.stringify(apiError("VOLUME_LIMIT_EXCEEDED", "Daily volume limit reached.", { volumeStatus: remitVolCheck }));
                  break;
                }

                try {
                  const privateKey = process.env.AGENT_PRIVATE_KEY;
                  if (!privateKey) {
                    result = JSON.stringify(apiError("MISSING_PRIVATE_KEY", "No AGENT_PRIVATE_KEY configured"));
                    const tcEntry = { tool: "execute_remittance", summary: `${corridor} — no private key` };
                    toolCallLog.push(tcEntry);
                    send("tool_call", tcEntry);
                    break;
                  }

                  const normalizedKey = (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as `0x${string}`;
                  const account = privateKeyToAccount(normalizedKey);

                  const decHash = commitDecision({
                    orderId: remitId,
                    action: "execute",
                    reasoning: (input.reasoning as string) || `Remittance ${amount} ${fromToken}→${toToken} to ${recipientAddress} (${corridor})`,
                    timestamp: Date.now(),
                    currentRate: 0,
                    targetRate: 0,
                    momentum: "n/a",
                    urgency: "immediate",
                  });
                  send("decision_hash", { orderId: remitId, hash: decHash, action: "execute" });

                  const wallet = createWalletClient({ account, chain: celo, transport: http("https://forno.celo.org") });
                  const feeCurrency = TOKENS.cUSD as `0x${string}`;
                  const { createPublicClient: createPubClient } = await import("viem");
                  const publicClient = createPubClient({ chain: celo, transport: http("https://forno.celo.org") });

                  let swapTxHash: string | undefined;
                  let transferAmount = amount;

                  // Step 1: Swap if cross-currency
                  if (fromToken !== toToken) {
                    const { buildSwapTx: buildMentoSwap } = await import("@/lib/mento-sdk");
                    const swapResult = await buildMentoSwap(fromToken, toToken, amount);

                    const appHash = await wallet.sendTransaction({ to: swapResult.approvalTx.to, data: swapResult.approvalTx.data as `0x${string}`, feeCurrency });
                    await publicClient.waitForTransactionReceipt({ hash: appHash });

                    const swHash = await wallet.sendTransaction({ to: swapResult.swapTx.to, data: swapResult.swapTx.data as `0x${string}`, feeCurrency });
                    await publicClient.waitForTransactionReceipt({ hash: swHash });

                    swapTxHash = swHash;
                    transferAmount = swapResult.summary.expectedOut;
                  }

                  // Step 2: Transfer to recipient
                  const { buildTransferTx } = await import("@/lib/mento-sdk");
                  const transferTx = buildTransferTx(toToken, recipientAddress as `0x${string}`, transferAmount);

                  const transferHash = await wallet.sendTransaction({
                    to: transferTx.to,
                    data: transferTx.data as `0x${string}`,
                    feeCurrency,
                  });
                  await publicClient.waitForTransactionReceipt({ hash: transferHash });

                  recordVolume(parseFloat(amount));

                  const trade: Trade = {
                    id: remitId,
                    pair: `${fromToken}/${toToken}`,
                    fromToken,
                    toToken,
                    amountIn: amount,
                    amountOut: transferAmount,
                    rate: fromToken !== toToken ? parseFloat(transferAmount) / parseFloat(amount) : 1,
                    spreadPct: 0,
                    status: "confirmed",
                    swapTxHash: transferHash,
                    timestamp: Date.now(),
                  };
                  addTrade(trade);

                  // Auto-advance any matching recurring transfer schedule
                  try {
                    const { getRecurring: getRecurringList, advanceNextExecution } = await import("@/lib/recurring-store");
                    const matching = getRecurringList({ active: true }).find(
                      r => r.recipientAddress.toLowerCase() === recipientAddress.toLowerCase() && r.fromToken === fromToken && r.toToken === toToken
                    );
                    if (matching) {
                      advanceNextExecution(matching.id);
                      const { updateRecurring: updateRec } = await import("@/lib/recurring-store");
                      updateRec(matching.id, { lastTxHash: transferHash });
                    }
                  } catch { /* non-critical */ }

                  const tcEntry = { tool: "execute_remittance", summary: `${corridor}: ${amount} ${fromToken}→${transferAmount} ${toToken} → ${recipientAddress.slice(0, 8)}...` };
                  toolCallLog.push(tcEntry);
                  send("tool_call", tcEntry);

                  result = JSON.stringify({
                    success: true,
                    remitId,
                    corridor,
                    fromToken,
                    toToken,
                    amountSent: amount,
                    amountDelivered: transferAmount,
                    recipientAddress,
                    swapTxHash: swapTxHash || "same-currency",
                    transferTxHash: transferHash,
                    decisionHash: decHash,
                  });
                } catch (err) {
                  const tcEntry = { tool: "execute_remittance", summary: `${corridor} FAILED: ${err instanceof Error ? err.message : "unknown"}` };
                  toolCallLog.push(tcEntry);
                  send("tool_call", tcEntry);
                  result = JSON.stringify({ error: `Remittance failed: ${err instanceof Error ? err.message : "unknown"}` });
                }
                break;
              }
              case "check_recurring_transfers": {
                try {
                  const { getRecurring } = await import("@/lib/recurring-store");
                  const dueTransfers = getRecurring({ active: true, dueNow: true });
                  const allActive = getRecurring({ active: true });

                  const tcEntry = {
                    tool: "check_recurring_transfers",
                    summary: `${dueTransfers.length} due now, ${allActive.length} active total`,
                  };
                  toolCallLog.push(tcEntry);
                  send("tool_call", tcEntry);

                  result = JSON.stringify({
                    dueTransfers: dueTransfers.map(t => ({
                      id: t.id,
                      fromToken: t.fromToken,
                      toToken: t.toToken,
                      amount: t.amount,
                      recipientAddress: t.recipientAddress,
                      corridor: t.corridor,
                      frequency: t.frequency,
                      executionCount: t.executionCount,
                    })),
                    activeCount: allActive.length,
                    instructions: dueTransfers.length > 0
                      ? "Execute each due transfer via execute_remittance, then the system will advance nextExecution automatically."
                      : "No recurring transfers are due right now.",
                  });
                } catch (err) {
                  result = JSON.stringify({ error: `Failed to check recurring transfers: ${err instanceof Error ? err.message : "unknown"}` });
                  const tcEntry = { tool: "check_recurring_transfers", summary: "Error checking recurring transfers" };
                  toolCallLog.push(tcEntry);
                  send("tool_call", tcEntry);
                }
                break;
              }
              case "fetch_defi_yields": {
                try {
                  const yields = await fetchCeloDefiYields();
                  result = JSON.stringify({
                    yields,
                    totalTvl: yields.reduce((s, y) => s + y.tvl, 0),
                    bestApy: yields.length > 0 ? Math.max(...yields.map(y => y.apy)) : 0,
                    source: "DeFiLlama",
                    instructions: "Compare these yields against vault idle capital. If a pool APY > 2% with TVL > $100K, consider deploying. Report yield opportunities alongside arbitrage analysis.",
                  });
                  const yieldEntry = { tool: "fetch_defi_yields", summary: `${yields.length} Celo stablecoin pools, best APY ${yields.length > 0 ? Math.max(...yields.map(y => y.apy)).toFixed(1) : 0}%` };
                  toolCallLog.push(yieldEntry);
                  send("tool_call", yieldEntry);
                } catch (err) {
                  result = JSON.stringify({ error: `Failed to fetch DeFi yields: ${err instanceof Error ? err.message : "unknown"}` });
                  const yieldEntry = { tool: "fetch_defi_yields", summary: "Yield fetch failed" };
                  toolCallLog.push(yieldEntry);
                  send("tool_call", yieldEntry);
                }
                break;
              }
              case "fetch_remittance_corridors": {
                try {
                  const res = await fetch(
                    "https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,BRL,MXN,PHP,INR,NGN,KES,GHS",
                    { signal: AbortSignal.timeout(8000) }
                  );
                  const data = await res.json();
                  const corridors = [
                    { corridor: "US→NG", pair: "USD/NGN", rate: data.rates?.NGN, currency: "NGN", region: "West Africa" },
                    { corridor: "US→KE", pair: "USD/KES", rate: data.rates?.KES, currency: "KES", region: "East Africa" },
                    { corridor: "US→EU", pair: "USD/EUR", rate: data.rates?.EUR, currency: "cEUR", region: "Europe" },
                    { corridor: "US→BR", pair: "USD/BRL", rate: data.rates?.BRL, currency: "cREAL", region: "South America" },
                    { corridor: "US→PH", pair: "USD/PHP", rate: data.rates?.PHP, currency: "PHP", region: "Southeast Asia" },
                    { corridor: "US→MX", pair: "USD/MXN", rate: data.rates?.MXN, currency: "MXN", region: "North America" },
                    { corridor: "US→IN", pair: "USD/INR", rate: data.rates?.INR, currency: "INR", region: "South Asia" },
                  ].filter(c => c.rate);

                  result = JSON.stringify({
                    corridors,
                    source: "Frankfurter (ECB)",
                    celoCorridors: ["US→EU (cUSD→cEUR)", "US→BR (cUSD→cREAL)"],
                    instructions: "cUSD→cEUR and cUSD→cREAL are natively supported on Mento. Other corridors can use cUSD as settlement currency. Compare Mento rates vs these forex rates to find favorable execution windows.",
                  });
                  const corrEntry = { tool: "fetch_remittance_corridors", summary: `${corridors.length} corridors, EUR ${data.rates?.EUR}, BRL ${data.rates?.BRL}` };
                  toolCallLog.push(corrEntry);
                  send("tool_call", corrEntry);
                } catch (err) {
                  result = JSON.stringify({ error: `Failed to fetch corridors: ${err instanceof Error ? err.message : "unknown"}` });
                  const corrEntry = { tool: "fetch_remittance_corridors", summary: "Corridor fetch failed" };
                  toolCallLog.push(corrEntry);
                  send("tool_call", corrEntry);
                }
                break;
              }
              case "get_rebalance_history": {
                try {
                  const { getRebalances, getCumulativeRebalanceCost } = await import("@/lib/rebalance-store");
                  const recent = getRebalances(10);
                  const cumulative = getCumulativeRebalanceCost();

                  const tcEntry = {
                    tool: "get_rebalance_history",
                    summary: `${cumulative.count} rebalances, $${cumulative.totalCostUsd.toFixed(4)} total cost`,
                  };
                  toolCallLog.push(tcEntry);
                  send("tool_call", tcEntry);

                  result = JSON.stringify({
                    recentRebalances: recent,
                    cumulative,
                    instructions: "Use this data to assess hedging efficiency. If avg cost per rebalance is high relative to drift reduction, consider widening the drift threshold.",
                  });
                } catch (err) {
                  result = JSON.stringify({ error: `Failed to get rebalance history: ${err instanceof Error ? err.message : "unknown"}` });
                  const tcEntry = { tool: "get_rebalance_history", summary: "Error fetching rebalance history" };
                  toolCallLog.push(tcEntry);
                  send("tool_call", tcEntry);
                }
                break;
              }
              default:
                result = JSON.stringify({ error: `Unknown tool: ${toolUse.name}` });
            }

            toolResults.push({
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: result,
            });
          }

          messages.push({ role: "user", content: toolResults });

          if (response.stop_reason === "end_turn") break;
        }

        // Return complete data as final event
        const { getSignals } = await import("@/lib/signal-store");
        const { getTrades } = await import("@/lib/trade-store");
        const currentSignals = getSignals();
        const agentSignals = currentSignals.filter((s) => s.id.startsWith("agent-"));
        const agentTrades = getTrades().filter((t) => t.id.startsWith("trade-"));

        send("complete", {
          success: true,
          signalCount,
          signals: agentSignals,
          trades: agentTrades,
          swaps: swapTxs,
          toolCalls: toolCallLog,
          iterations,
          tee: {
            status: teeAttestation.status,
            verified: teeAttestation.verified,
            quote: teeAttestation.quote,
          },
          message: `Analysis complete. Generated ${signalCount} signals${swapTxs.length > 0 ? ` and ${swapTxs.length} swap(s)` : ""}.`,
        });
      } catch (err) {
        send("error", { error: err instanceof Error ? err.message : "Analysis failed" });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...getTeeHeaders(),
    },
  });
}
