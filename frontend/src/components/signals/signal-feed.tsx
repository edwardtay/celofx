"use client";

import { useState, useMemo } from "react";
import { SignalCard } from "./signal-card";
import type { Signal, MarketType } from "@/lib/types";
import { cn } from "@/lib/utils";

const tabs: { value: MarketType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "mento", label: "Mento FX" },
  { value: "forex", label: "Forex" },
  { value: "crypto", label: "Crypto" },
  { value: "commodities", label: "Commodities" },
];

export function SignalFeed({ signals }: { signals: Signal[] }) {
  const [activeTab, setActiveTab] = useState<MarketType | "all">("all");

  const filtered =
    activeTab === "all"
      ? signals
      : signals.filter((s) => s.market === activeTab);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: signals.length };
    for (const s of signals) {
      counts[s.market] = (counts[s.market] ?? 0) + 1;
    }
    return counts;
  }, [signals]);

  const countFor = (tab: MarketType | "all") => tabCounts[tab] ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b" role="tablist" aria-label="Filter signals by market">
        {tabs.map((tab) => {
          const count = countFor(tab.value);
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              role="tab"
              aria-selected={isActive}
              aria-controls="signal-list"
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5",
                isActive
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {count > 0 && (
                <span className={cn(
                  "text-[10px] font-mono px-1.5 py-0.5 rounded-full",
                  isActive
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground"
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="space-y-3" id="signal-list" role="tabpanel">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No {activeTab === "all" ? "" : activeTab + " "}signals yet</p>
            <p className="text-xs mt-1">Run analysis from the dashboard to generate signals</p>
          </div>
        ) : (
          filtered.map((signal) => (
            <SignalCard key={signal.id} signal={signal} />
          ))
        )}
      </div>
    </div>
  );
}
