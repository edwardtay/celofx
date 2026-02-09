"use client";

import { useTrades } from "@/hooks/use-trades";
import { useSignals } from "@/hooks/use-signals";
import { useMentoData } from "@/hooks/use-market-data";
import { ExternalLink } from "lucide-react";

export function LiveStats() {
  const { data: trades } = useTrades();
  const { data: signals } = useSignals();
  const { data: mentoRates } = useMentoData();

  const confirmedTrades = (trades ?? []).filter(
    (t) => t.status === "confirmed"
  );
  const totalPnl = confirmedTrades.reduce(
    (sum, t) => sum + (t.pnl ?? 0),
    0
  );
  const signalCount = (signals ?? []).length;
  const mentoLive = (mentoRates ?? []).length > 0;

  if (confirmedTrades.length === 0 && signalCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      {confirmedTrades.length > 0 && (
        <span className="flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          {confirmedTrades.length} on-chain swap{confirmedTrades.length !== 1 ? "s" : ""}
        </span>
      )}
      {totalPnl > 0 && (
        <span className="text-emerald-600 font-mono">
          +{totalPnl.toFixed(2)}% cumulative P&L
        </span>
      )}
      {signalCount > 0 && (
        <span>{signalCount} active signals</span>
      )}
      {mentoLive && (
        <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live Mento data
        </span>
      )}
      <a
        href="https://celoscan.io/address/0x1e67a46D364B1e67a2857c21dd8e2CCEc5A3dB23"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        Agent wallet
        <ExternalLink className="size-2.5" />
      </a>
    </div>
  );
}
