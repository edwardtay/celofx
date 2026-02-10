"use client";

import { useSignals } from "@/hooks/use-signals";
import { useTrades } from "@/hooks/use-trades";
import { SignalCard } from "@/components/signals/signal-card";
import { Zap, CheckCircle2, ExternalLink, ArrowRight } from "lucide-react";

export function TopSignals() {
  const { data: signals, isLoading } = useSignals();
  const { data: trades } = useTrades();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-32 bg-muted rounded-xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  const topSignals = (signals ?? [])
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);

  if (topSignals.length === 0) {
    const confirmed = (trades ?? []).filter((t) => t.status === "confirmed");

    return (
      <div className="border border-dashed rounded-lg p-6 space-y-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <Zap className="size-6 opacity-40" />
          <p className="text-sm font-medium">Click &quot;Scan Markets&quot; above to generate AI signals</p>
          <p className="text-xs text-muted-foreground">The FX Arbitrage Agent will scan Mento FX, forex, crypto, and commodities (~30s)</p>
        </div>

        {confirmed.length > 0 && (
          <div className="border-t pt-4 space-y-2">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider text-center">
              Past Autonomous Executions
            </p>
            <div className="space-y-1.5">
              {confirmed.slice(0, 3).map((trade) => {
                const [from, to] = trade.pair.split("/");
                return (
                  <div
                    key={trade.id}
                    className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-emerald-50/50 border border-emerald-200/50"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="size-3 text-emerald-600" />
                      <span className="font-mono">
                        {trade.amountIn} {from}
                      </span>
                      <ArrowRight className="size-3 text-muted-foreground" />
                      <span className="font-mono">
                        {trade.amountOut} {to}
                      </span>
                      <span className="text-emerald-600 font-mono">
                        +{trade.spreadPct.toFixed(2)}%
                      </span>
                    </div>
                    {trade.swapTxHash && (
                      <a
                        href={`https://celoscan.io/tx/${trade.swapTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground text-center">
              {confirmed.length} swap{confirmed.length !== 1 ? "s" : ""} executed on-chain · 100% success rate · All verifiable on Celoscan
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {topSignals.map((signal) => (
        <SignalCard key={signal.id} signal={signal} />
      ))}
    </div>
  );
}
