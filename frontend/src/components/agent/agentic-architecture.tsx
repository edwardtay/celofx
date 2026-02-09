"use client";

import {
  Brain,
  BarChart3,
  DollarSign,
  Bitcoin,
  Gem,
  Zap,
  ArrowRight,
  Repeat,
  ExternalLink,
} from "lucide-react";

const tools = [
  {
    name: "fetch_mento_rates",
    label: "Mento Rates",
    icon: DollarSign,
    desc: "On-chain getAmountOut()",
    color: "text-blue-600 bg-blue-50 border-blue-200",
  },
  {
    name: "fetch_forex",
    label: "Forex Rates",
    icon: DollarSign,
    desc: "EUR/USD, GBP/USD, JPY",
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
  },
  {
    name: "fetch_crypto",
    label: "Crypto Prices",
    icon: Bitcoin,
    desc: "BTC, ETH, SOL, CELO",
    color: "text-orange-600 bg-orange-50 border-orange-200",
  },
  {
    name: "fetch_commodities",
    label: "Commodities",
    icon: Gem,
    desc: "Gold, Oil, Silver",
    color: "text-amber-600 bg-amber-50 border-amber-200",
  },
  {
    name: "generate_signal",
    label: "Generate Signal",
    icon: BarChart3,
    desc: "Long/short/hold + reasoning",
    color: "text-violet-600 bg-violet-50 border-violet-200",
  },
  {
    name: "generate_fx_action",
    label: "FX Action",
    icon: Zap,
    desc: "Mento swap recommendation",
    color: "text-pink-600 bg-pink-50 border-pink-200",
  },
  {
    name: "execute_mento_swap",
    label: "Execute Swap",
    icon: ArrowRight,
    desc: "Broker.swapIn() on Celo",
    color: "text-red-600 bg-red-50 border-red-200",
  },
];

export function AgenticArchitecture() {
  return (
    <div className="border rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="size-4 text-violet-500" />
          <h3 className="text-sm font-medium">Agentic Architecture</h3>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">
          Claude Sonnet 4.5 · 7 tools · max 10 iterations
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Repeat className="size-3 shrink-0" />
        <span>
          Agentic loop — Claude calls tools, receives results, reasons, and calls more tools until analysis is complete
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {tools.map((tool) => (
          <div
            key={tool.name}
            className={`flex items-start gap-2 p-2 rounded-lg border text-xs ${tool.color}`}
          >
            <tool.icon className="size-3.5 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-medium leading-tight truncate">{tool.label}</p>
              <p className="text-[10px] opacity-75 leading-tight">{tool.desc}</p>
            </div>
          </div>
        ))}
        <div className="flex items-start gap-2 p-2 rounded-lg border text-xs text-muted-foreground bg-muted/30 border-border">
          <Brain className="size-3.5 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-medium leading-tight">Claude AI</p>
            <p className="text-[10px] opacity-75 leading-tight">Orchestrates all tools</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t">
        <span>
          Data → Analysis → Signals → Execution — fully autonomous, no human in the loop
        </span>
        <a
          href="https://docs.anthropic.com/en/docs/build-with-claude/tool-use"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors shrink-0"
        >
          Tool use docs
          <ExternalLink className="size-2.5" />
        </a>
      </div>
    </div>
  );
}
