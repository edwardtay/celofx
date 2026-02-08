"use client";

import { useState } from "react";
import { SignalCard } from "./signal-card";
import type { Signal, MarketType } from "@/lib/types";
import { cn } from "@/lib/utils";

const tabs: { value: MarketType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "crypto", label: "Crypto" },
  { value: "stocks", label: "Stocks" },
  { value: "forex", label: "Forex" },
  { value: "commodities", label: "Commodities" },
];

export function SignalFeed({ signals }: { signals: Signal[] }) {
  const [activeTab, setActiveTab] = useState<MarketType | "all">("all");

  const filtered =
    activeTab === "all"
      ? signals
      : signals.filter((s) => s.market === activeTab);

  const countFor = (tab: MarketType | "all") =>
    tab === "all" ? signals.length : signals.filter((s) => s.market === tab).length;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => {
          const count = countFor(tab.value);
          return (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-1.5",
                activeTab === tab.value
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {count > 0 && (
                <span className={cn(
                  "text-[10px] font-mono px-1.5 py-0.5 rounded-full",
                  activeTab === tab.value
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

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            No signals found for this market.
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
