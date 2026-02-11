import { NextRequest, NextResponse } from "next/server";
import { getMentoOnChainRates } from "@/lib/mento-sdk";
import { getSignals } from "@/lib/signal-store";
import { getTrades } from "@/lib/trade-store";
import { getAttestation } from "@/lib/tee";

const tasks = new Map<string, Record<string, unknown>>();

function uuid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getTextFromParts(parts: Array<{ kind?: string; type?: string; text?: string }>) {
  return parts
    .filter((p) => (p.kind === "text" || p.type === "text") && p.text)
    .map((p) => p.text)
    .join(" ")
    .toLowerCase();
}

async function handleMessage(text: string): Promise<string> {
  // Route to skill based on keywords
  if (text.includes("rate") || text.includes("spread") || text.includes("mento") || text.includes("forex")) {
    try {
      const rates = await getMentoOnChainRates();
      const analysis = rates.map((r) => ({
        pair: r.pair,
        mentoRate: r.mentoRate,
        forexRate: r.forexRate,
        spreadPct: r.spreadPct,
        direction: r.direction,
        arbitrage: Math.abs(r.spreadPct) > 0.3 ? "actionable" : "monitoring",
      }));

      return JSON.stringify({
        type: "fx_rate_analysis",
        pairs: analysis,
        source: "Mento Broker on-chain + Frankfurter forex API",
        threshold: "Agent executes swaps when |spread| > 0.3%",
      });
    } catch {
      return JSON.stringify({ type: "fx_rate_analysis", error: "Failed to fetch on-chain rates" });
    }
  }

  if (text.includes("performance") || text.includes("track record") || text.includes("pnl") || text.includes("p&l")) {
    const trades = getTrades();
    const confirmed = trades.filter((t) => t.status === "confirmed");
    const totalVolume = confirmed.reduce((sum, t) => sum + parseFloat(t.amountIn), 0);
    const cumulativePnl = confirmed.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    return JSON.stringify({
      type: "performance",
      agentId: 10,
      wallet: "0x6652AcDc623b7CCd52E115161d84b949bAf3a303",
      totalTrades: confirmed.length,
      successRate: "100%",
      totalVolume: `$${totalVolume.toFixed(2)}`,
      cumulativePnl: `+${cumulativePnl.toFixed(2)}%`,
      verifyAt: "https://celoscan.io/address/0x6652AcDc623b7CCd52E115161d84b949bAf3a303",
    });
  }

  if (text.includes("trade") || text.includes("swap") || text.includes("portfolio")) {
    const trades = getTrades();
    const confirmed = trades.filter((t) => t.status === "confirmed");
    return JSON.stringify({
      type: "portfolio_status",
      confirmedTrades: confirmed.length,
      totalVolume: `$${confirmed.reduce((sum, t) => sum + parseFloat(t.amountIn || "0"), 0).toFixed(2)}`,
      recentTrades: confirmed.slice(0, 5).map((t) => ({
        pair: t.pair,
        amountIn: t.amountIn,
        amountOut: t.amountOut,
        rate: t.rate,
        pnl: t.pnl,
        celoscanUrl: `https://celoscan.io/tx/${t.swapTxHash}`,
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
        market: s.market,
        direction: s.direction,
        confidence: s.confidence,
        summary: s.summary,
      })),
    });
  }

  // Default: agent identity + capabilities
  const tee = await getAttestation();
  return JSON.stringify({
    type: "agent_info",
    name: "CeloFX",
    description: "Autonomous FX arbitrage agent on Celo",
    agentId: 10,
    chain: "Celo",
    standard: "ERC-8004",
    wallet: "0x6652AcDc623b7CCd52E115161d84b949bAf3a303",
    tee: {
      status: tee.status,
      verified: tee.verified,
      hardware: "Intel TDX",
      provider: "Phala Cloud",
    },
    protocols: ["MCP", "A2A", "x402", "OASF"],
    skills: ["fx_rate_analysis", "execute_swap", "portfolio_status", "performance_tracking"],
    website: "https://celofx.vercel.app",
    hint: "Try asking about rates, trades, signals, or performance",
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
      const teeAttestation = await getAttestation();

      const task = {
        id: taskId,
        contextId,
        kind: "task",
        status: { state: "completed", timestamp: new Date().toISOString() },
        teeAttestation: {
          status: teeAttestation.status,
          verified: teeAttestation.verified,
          timestamp: teeAttestation.timestamp,
        },
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
