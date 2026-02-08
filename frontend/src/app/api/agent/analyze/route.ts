import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { agentTools, AGENT_SYSTEM_PROMPT } from "@/lib/agent-tools";
import {
  fetchCryptoPrices,
  fetchForexRates,
  fetchStockPrices,
  fetchCommodityPrices,
} from "@/lib/market-data";
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

  try {
    const messages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content:
          "Analyze all four markets right now. Fetch data from crypto, stocks, forex, and commodities, then generate 3-5 high-conviction trading signals across different markets.",
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
          case "fetch_stocks": {
            const data = await fetchStockPrices();
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
      message: `Analysis complete. Generated ${signalCount} new signals.`,
    });
  } catch (error) {
    console.error("Agent analysis error:", error);
    return NextResponse.json(
      { error: "Analysis failed", details: String(error) },
      { status: 500 }
    );
  }
}
