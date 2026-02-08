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

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px",
              activeTab === tab.value
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
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
