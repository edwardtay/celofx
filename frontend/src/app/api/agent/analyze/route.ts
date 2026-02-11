import Anthropic from "@anthropic-ai/sdk";
import { agentTools, AGENT_SYSTEM_PROMPT } from "@/lib/agent-tools";
import {
  fetchCryptoPrices,
  fetchForexRates,
  fetchCommodityPrices,
  fetchMentoRates,
} from "@/lib/market-data";
import { getMentoOnChainRates, buildSwapTx, type MentoToken, TOKENS } from "@/lib/mento-sdk";
import { addSignal } from "@/lib/signal-store";
import { addTrade, updateTrade } from "@/lib/trade-store";
import type { Signal, Trade, MarketType, SignalDirection, SignalTier } from "@/lib/types";
import { createWalletClient, http, type Hash } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { getAttestation, getTeeHeaders } from "@/lib/tee";

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
  const auth = verifyAuth(request);
  if (!auth.ok) {
    return new Response(
      JSON.stringify({ error: "Rate limited — wait 30 seconds" }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

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
              case "execute_mento_swap": {
                const input = toolUse.input as Record<string, unknown>;
                const tradeId = `trade-${Date.now()}-${signalCount}`;
                const fromToken = input.fromToken as MentoToken;
                const toToken = input.toToken as MentoToken;
                const amount = input.amount as string;
                const spreadPct = (input.spreadPct as number) || 0;

                // ── PROFITABILITY GUARD ──
                // Verify on-chain rate vs forex before executing. Protects vault depositors.
                const MIN_PROFITABLE_SPREAD = 0.3; // %
                if (spreadPct < MIN_PROFITABLE_SPREAD) {
                  const tcEntry = {
                    tool: "execute_mento_swap",
                    summary: `${fromToken}→${toToken} BLOCKED — spread ${spreadPct.toFixed(2)}% below +${MIN_PROFITABLE_SPREAD}% threshold`,
                  };
                  toolCallLog.push(tcEntry);
                  send("tool_call", tcEntry);
                  result = JSON.stringify({
                    error: `Swap rejected: spread ${spreadPct.toFixed(2)}% is below the +${MIN_PROFITABLE_SPREAD}% profitability threshold. Only positive spreads (Mento gives MORE than forex) above ${MIN_PROFITABLE_SPREAD}% are executed. Current spread is ${spreadPct < 0 ? "negative (Mento gives less than forex — would lose money)" : "too small to cover fees"}. Vault capital protected.`,
                    spreadPct,
                    threshold: MIN_PROFITABLE_SPREAD,
                  });
                  break;
                }

                try {
                  // Double-check: fetch fresh on-chain rate to verify profitability
                  const { getOnChainQuote } = await import("@/lib/mento-sdk");
                  const freshQuote = await getOnChainQuote(fromToken, toToken, "1");
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
                    if (realSpread < MIN_PROFITABLE_SPREAD) {
                      const tcEntry = {
                        tool: "execute_mento_swap",
                        summary: `${fromToken}→${toToken} BLOCKED — verified spread ${realSpread.toFixed(2)}% (on-chain check)`,
                      };
                      toolCallLog.push(tcEntry);
                      send("tool_call", tcEntry);
                      result = JSON.stringify({
                        error: `Swap rejected after on-chain verification: real spread is ${realSpread.toFixed(2)}% (Mento: ${freshQuote.rate.toFixed(6)}, Forex: ${expectedForex.toFixed(6)}). Need > +${MIN_PROFITABLE_SPREAD}% to be profitable. Vault capital protected.`,
                        verifiedSpread: realSpread,
                        mentoRate: freshQuote.rate,
                        forexRate: expectedForex,
                      });
                      break;
                    }
                  }

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
                    updateTrade(tradeId, {
                      status: txStatus,
                      approvalTxHash: approvalHash,
                      swapTxHash: swapHash,
                    });
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
