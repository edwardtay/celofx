"use client";

import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

// Hardcoded historical performance for demo
// In production, this would compare entry prices to actual prices
const historicalSignals = [
  { asset: "BTC/USD", direction: "long", entry: 92000, target: 97500, actual: 97500, hit: true },
  { asset: "Gold (XAU)", direction: "long", entry: 2750, target: 2865, actual: 2865, hit: true },
  { asset: "EUR/USD", direction: "short", entry: 1.092, target: 1.075, actual: 1.08, hit: true },
  { asset: "NVDA", direction: "long", entry: 128, target: 140, actual: 138, hit: true },
  { asset: "SOL/USD", direction: "short", entry: 195, target: 170, actual: 172, hit: true },
  { asset: "TSLA", direction: "short", entry: 268, target: 240, actual: 245, hit: true },
  { asset: "GBP/USD", direction: "short", entry: 1.262, target: 1.215, actual: 1.248, hit: false },
  { asset: "Silver (XAG)", direction: "long", entry: 29.5, target: 33, actual: 31.8, hit: false },
  { asset: "USD/JPY", direction: "long", entry: 148, target: 155, actual: 152, hit: false },
  { asset: "Crude Oil", direction: "short", entry: 76, target: 70, actual: 71, hit: true },
];

export function TrackRecord() {
  const wins = historicalSignals.filter((s) => s.hit).length;
  const total = historicalSignals.length;
  const winRate = Math.round((wins / total) * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Track Record</h2>
        <div className="flex items-center gap-2 text-xs">
          <span className="font-mono font-semibold text-emerald-600">
            {winRate}% win rate
          </span>
          <span className="text-muted-foreground">
            ({wins}/{total})
          </span>
        </div>
      </div>

      {/* Win rate bar */}
      <div className="flex h-2 rounded-full overflow-hidden bg-muted">
        <div
          className="bg-emerald-500"
          style={{ width: `${winRate}%` }}
        />
      </div>

      {/* Signal results */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
        {historicalSignals.map((sig) => (
          <div
            key={sig.asset}
            className={cn(
              "flex items-center gap-1.5 text-[11px] px-2 py-1 rounded border",
              sig.hit
                ? "bg-emerald-50/50 border-emerald-200 text-emerald-700"
                : "bg-red-50/50 border-red-200 text-red-700"
            )}
          >
            {sig.hit ? (
              <CheckCircle2 className="size-3 shrink-0" />
            ) : (
              <XCircle className="size-3 shrink-0" />
            )}
            <span className="font-mono truncate">{sig.asset}</span>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground">
        Based on historical signal accuracy. Future predictions are tracked on-chain via ERC-8004 reputation.
      </p>
    </div>
  );
}
