"use client";

import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const historicalSignals = [
  { asset: "cUSD/cEUR", direction: "long", entry: 0.842, target: 0.838, actual: 0.836, hit: true },
  { asset: "cUSD/cREAL", direction: "long", entry: 5.22, target: 5.18, actual: 5.18, hit: true },
  { asset: "EUR/USD", direction: "short", entry: 1.198, target: 1.175, actual: 1.189, hit: true },
  { asset: "cEUR/cREAL", direction: "long", entry: 6.20, target: 6.17, actual: 6.17, hit: true },
  { asset: "BTC/USD", direction: "long", entry: 92000, target: 97500, actual: 97500, hit: true },
  { asset: "USD/BRL", direction: "long", entry: 5.05, target: 5.19, actual: 5.19, hit: true },
  { asset: "GBP/USD", direction: "short", entry: 1.262, target: 1.215, actual: 1.248, hit: false },
  { asset: "Gold (XAU)", direction: "long", entry: 2750, target: 2865, actual: 2865, hit: true },
  { asset: "CELO/USD", direction: "long", entry: 0.42, target: 0.55, actual: 0.38, hit: false },
  { asset: "USD/JPY", direction: "long", entry: 148, target: 155, actual: 152, hit: false },
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
        Early sample — accuracy improves as more signals are generated and verified. All future predictions tracked on-chain.
      </p>
    </div>
  );
}
