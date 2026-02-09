"use client";

import {
  Clock,
  BarChart3,
  Brain,
  Zap,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

const steps = [
  {
    icon: Clock,
    label: "Cron Trigger",
    detail: "Daily at 8:00 UTC",
    color: "text-blue-600 bg-blue-50 border-blue-200",
  },
  {
    icon: BarChart3,
    label: "Fetch Markets",
    detail: "Mento, Forex, Crypto",
    color: "text-amber-600 bg-amber-50 border-amber-200",
  },
  {
    icon: Brain,
    label: "Claude AI",
    detail: "Cross-market analysis",
    color: "text-violet-600 bg-violet-50 border-violet-200",
  },
  {
    icon: Zap,
    label: "Auto-Execute",
    detail: "Swap if spread > 0.3%",
    color: "text-orange-600 bg-orange-50 border-orange-200",
  },
  {
    icon: CheckCircle2,
    label: "On-Chain",
    detail: "Verifiable on Celoscan",
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
  },
];

export function AutonomousLoop() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Autonomous Loop</h2>
        <a
          href="/api/agent/track-record"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
        >
          Track Record API
          <ExternalLink className="size-2.5" />
        </a>
      </div>
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {steps.map((step, i) => (
          <div key={step.label} className="flex items-center gap-1 shrink-0">
            <div
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs ${step.color}`}
            >
              <step.icon className="size-3.5 shrink-0" />
              <div>
                <p className="font-medium leading-tight">{step.label}</p>
                <p className="text-[10px] opacity-75">{step.detail}</p>
              </div>
            </div>
            {i < steps.length - 1 && (
              <ArrowRight className="size-3 text-muted-foreground shrink-0" />
            )}
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">
        No human intervention — the agent scans, analyzes, and executes entirely on its own. Every action is verifiable on-chain.
      </p>
    </div>
  );
}
