import { NextRequest, NextResponse } from "next/server";
import { getMentoOnChainRates } from "@/lib/mento-sdk";
import { getSignals } from "@/lib/signal-store";
import { getTrades } from "@/lib/trade-store";

const tasks = new Map<string, Record<string, unknown>>();

function uuid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getTextFromParts(parts: Array<{ kind: string; text?: string }>) {
  return parts
    .filter((p) => p.kind === "text" && p.text)
    .map((p) => p.text)
    .join(" ")
    .toLowerCase();
}

async function handleMessage(text: string) {
  // Route to skill based on keywords
  if (text.includes("rate") || text.includes("spread") || text.includes("mento")) {
    try {
      const rates = await getMentoOnChainRates();
      return JSON.stringify({ type: "fx_rate_analysis", rates });
    } catch {
      return JSON.stringify({ type: "fx_rate_analysis", error: "Failed to fetch rates" });
    }
  }

  if (text.includes("trade") || text.includes("swap") || text.includes("portfolio")) {
    const trades = getTrades();
    const confirmed = trades.filter((t) => t.status === "confirmed");
    return JSON.stringify({
      type: "portfolio_status",
      trades: confirmed.length,
      volume: confirmed.reduce((sum, t) => sum + parseFloat(t.amountIn || "0"), 0).toFixed(2),
      recentTrades: confirmed.slice(0, 5).map((t) => ({
        pair: t.pair,
        amountIn: t.amountIn,
        amountOut: t.amountOut,
        rate: t.rate,
        txHash: t.swapTxHash,
      })),
    });
  }

  if (text.includes("signal")) {
    const signals = getSignals();
    return JSON.stringify({
      type: "signals",
      count: signals.length,
      signals: signals.slice(0, 5).map((s) => ({
        asset: s.asset,
        direction: s.direction,
        confidence: s.confidence,
        summary: s.summary,
      })),
    });
  }

  // Default: agent info
  return JSON.stringify({
    type: "agent_info",
    name: "CeloFX",
    agentId: 4,
    chain: "Celo",
    capabilities: ["fx_rate_analysis", "execute_swap", "portfolio_status"],
    website: "https://celofx.vercel.app",
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { jsonrpc, id, method, params } = body;

  if (jsonrpc !== "2.0") {
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      error: { code: -32600, message: "Invalid JSON-RPC version" },
    });
  }

  switch (method) {
    case "message/send": {
      const { message } = params;
      const taskId = uuid();
      const contextId = message.contextId || uuid();
      const userText = getTextFromParts(message.parts || []);

      const result = await handleMessage(userText);

      const task = {
        id: taskId,
        contextId,
        kind: "task",
        status: { state: "completed", timestamp: new Date().toISOString() },
        artifacts: [
          {
            artifactId: uuid(),
            name: "response",
            parts: [{ kind: "text", text: result }],
          },
        ],
      };

      tasks.set(taskId, task);
      return NextResponse.json({ jsonrpc: "2.0", id, result: task });
    }

    case "tasks/get": {
      const task = tasks.get(params.id);
      if (!task) {
        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          error: { code: -32001, message: "Task not found" },
        });
      }
      return NextResponse.json({ jsonrpc: "2.0", id, result: task });
    }

    case "tasks/cancel": {
      const task = tasks.get(params.id);
      if (!task) {
        return NextResponse.json({
          jsonrpc: "2.0",
          id,
          error: { code: -32001, message: "Task not found" },
        });
      }
      (task as Record<string, unknown>).status = {
        state: "canceled",
        timestamp: new Date().toISOString(),
      };
      return NextResponse.json({ jsonrpc: "2.0", id, result: task });
    }

    default:
      return NextResponse.json({
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      });
  }
}
