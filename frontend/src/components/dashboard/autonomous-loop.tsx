"use client";

import { useEffect, useState } from "react";
import {
  Clock,
  BarChart3,
  Brain,
  Zap,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Radio,
} from "lucide-react";

const BACKEND_URL = "https://celofx-agent.leverlabs.workers.dev";

interface BackendStats {
  totalScans: number;
  latestScan: string | null;
  totalSignals: number;
  totalTrades: number;
  autonomousExecution: boolean;
}

const steps = [
  {
    icon: Clock,
    label: "Cron Trigger",
    detail: "Every 15 minutes",
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

function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function AutonomousLoop() {
  const [stats, setStats] = useState<BackendStats | null>(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/stats`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Autonomous Loop</h2>
          {stats && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
              <Radio className="size-2.5 animate-pulse" />
              Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {stats && (
            <span className="text-[10px] text-muted-foreground">
              {stats.totalScans} scans · {stats.totalSignals} signals
              {stats.totalTrades > 0 && ` · ${stats.totalTrades} auto-swaps`}
              {stats.latestScan && ` · last ${timeAgo(stats.latestScan)}`}
            </span>
          )}
          <a
            href={`${BACKEND_URL}/stats`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
          >
            Backend API
            <ExternalLink className="size-2.5" />
          </a>
        </div>
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
        Cloudflare Worker runs every 15 min — fetches Mento on-chain rates, compares with forex, generates signals. No human intervention.
      </p>
    </div>
  );
}
