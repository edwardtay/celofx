import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { agentTools, AGENT_SYSTEM_PROMPT } from "@/lib/agent-tools";
import {
  fetchCryptoPrices,
  fetchForexRates,
  fetchCommodityPrices,
  fetchMentoRates,
} from "@/lib/market-data";
import { getMentoOnChainRates, buildSwapTx, type MentoToken } from "@/lib/mento-sdk";
import { addSignal } from "@/lib/signal-store";
import type { Signal, MarketType, SignalDirection, SignalTier } from "@/lib/types";

export const maxDuration = 60;

export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "API key not configured. Set ANTHROPIC_API_KEY in environment." },
      { status: 503 }
    );
  }

  const client = new Anthropic({ apiKey });
  let signalCount = 0;
  const swapTxs: Array<{ fromToken: string; toToken: string; amount: string; rate: number; expectedOut: string }> = [];

  try {
    const messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content:
          "Analyze markets with a focus on FX opportunities. Fetch Mento on-chain rates first, then forex, crypto, and commodities. Compare Mento stablecoin rates against real forex rates to find swap opportunities. Generate 3-5 signals — prioritize Mento FX actions where spreads are favorable.",
      },
    ];

    // Agentic loop — run until model stops calling tools
    let iterations = 0;
    const MAX_ITERATIONS = 10;

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const response = await client.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4096,
        system: AGENT_SYSTEM_PROMPT,
        tools: agentTools,
        messages,
      });

      // Collect tool use blocks
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ContentBlock & { type: "tool_use" } =>
          block.type === "tool_use"
      );

      if (toolUseBlocks.length === 0) {
        // No more tool calls — agent is done
        break;
      }

      // Add assistant response to messages
      messages.push({ role: "assistant", content: response.content });

      // Process each tool call
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        let result: string;

        switch (toolUse.name) {
          case "fetch_crypto": {
            const data = await fetchCryptoPrices();
            result = JSON.stringify(data);
            break;
          }
          case "fetch_forex": {
            const data = await fetchForexRates();
            result = JSON.stringify(data);
            break;
          }
          case "fetch_commodities": {
            const data = fetchCommodityPrices();
            result = JSON.stringify(data);
            break;
          }
          case "fetch_mento_rates": {
            // Try real on-chain Mento Broker rates first
            try {
              const onChainData = await getMentoOnChainRates();
              if (onChainData.length > 0) {
                result = JSON.stringify(onChainData);
                break;
              }
            } catch {
              // Fall through to CoinGecko fallback
            }
            const data = await fetchMentoRates();
            result = JSON.stringify(data);
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
            signalCount++;
            result = JSON.stringify({
              success: true,
              signalId: signal.id,
              message: `FX action: SWAP ${input.fromToken} → ${input.toToken} (${signal.confidence}% confidence)`,
            });
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
            signalCount++;
            result = JSON.stringify({
              success: true,
              signalId: signal.id,
              message: `Signal generated: ${signal.direction.toUpperCase()} ${signal.asset} (${signal.confidence}% confidence)`,
            });
            break;
          }
          case "execute_mento_swap": {
            const input = toolUse.input as Record<string, unknown>;
            try {
              const swapResult = await buildSwapTx(
                input.fromToken as MentoToken,
                input.toToken as MentoToken,
                input.amount as string
              );
              swapTxs.push({
                fromToken: input.fromToken as string,
                toToken: input.toToken as string,
                amount: input.amount as string,
                rate: swapResult.summary.rate,
                expectedOut: swapResult.summary.expectedOut,
              });
              // Also generate a signal for this swap
              const signal: Signal = {
                id: `agent-swap-${Date.now()}-${signalCount}`,
                market: "mento" as MarketType,
                asset: `${input.fromToken}/${input.toToken}`,
                direction: "long" as SignalDirection,
                confidence: 85,
                summary: `Swap ${input.amount} ${input.fromToken} → ${swapResult.summary.expectedOut.slice(0, 8)} ${input.toToken} via Mento Broker`,
                reasoning: input.reasoning as string,
                entryPrice: swapResult.summary.rate,
                tier: "premium" as SignalTier,
                timestamp: Date.now(),
              };
              addSignal(signal);
              signalCount++;
              result = JSON.stringify({
                success: true,
                signalId: signal.id,
                swap: {
                  ...swapResult.summary,
                  brokerAddress: "0x777A8255cA72412f0d706dc03C9D1987306B4CaD",
                  status: "tx_ready",
                },
                message: `Swap transaction built: ${input.amount} ${input.fromToken} → ${swapResult.summary.expectedOut} ${input.toToken} (rate: ${swapResult.summary.rate.toFixed(6)})`,
              });
            } catch (err) {
              result = JSON.stringify({
                error: `Failed to build swap: ${err instanceof Error ? err.message : "unknown error"}`,
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

    // Return generated signals so client can display them immediately
    // (serverless instances don't share in-memory state)
    const { getSignals } = await import("@/lib/signal-store");
    const currentSignals = getSignals();
    const agentSignals = currentSignals.filter((s) => s.id.startsWith("agent-"));

    return NextResponse.json({
      success: true,
      signalCount,
      signals: agentSignals,
      swaps: swapTxs,
      message: `Analysis complete. Generated ${signalCount} signals${swapTxs.length > 0 ? ` and ${swapTxs.length} swap transaction(s)` : ""}.`,
    });
  } catch {
    return NextResponse.json(
      { error: "Analysis failed" },
      { status: 500 }
    );
  }
}
