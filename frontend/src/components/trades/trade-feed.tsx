"use client";

import { useState } from "react";
import { TradeCard } from "./trade-card";
import type { Trade, TradeStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const tabs: { value: TradeStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "confirmed", label: "Confirmed" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
];

export function TradeFeed({ trades }: { trades: Trade[] }) {
  const [activeTab, setActiveTab] = useState<TradeStatus | "all">("all");

  const filtered =
    activeTab === "all"
      ? trades
      : trades.filter((t) => t.status === activeTab);

  const countFor = (tab: TradeStatus | "all") =>
    tab === "all" ? trades.length : trades.filter((t) => t.status === tab).length;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b" role="tablist" aria-label="Filter trades by status">
        {tabs.map((tab) => {
          const count = countFor(tab.value);
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              role="tab"
              aria-selected={isActive}
              aria-controls="trade-list"
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

      <div className="space-y-3" id="trade-list" role="tabpanel">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No {activeTab === "all" ? "" : activeTab + " "}trades yet</p>
            <p className="text-xs mt-1">Trades are recorded when the agent executes swaps</p>
          </div>
        ) : (
          filtered.map((trade) => (
            <TradeCard key={trade.id} trade={trade} />
          ))
        )}
      </div>
    </div>
  );
}
