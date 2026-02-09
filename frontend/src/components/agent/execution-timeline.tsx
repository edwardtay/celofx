"use client";

import { useTrades } from "@/hooks/use-trades";
import {
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  Zap,
  Bot,
} from "lucide-react";
import { formatTimeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ExecutionTimeline() {
  const { data: trades, isLoading } = useTrades();

  const confirmed = (trades ?? [])
    .filter((t) => t.status === "confirmed")
    .sort((a, b) => b.timestamp - a.timestamp);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Execution History</h3>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (confirmed.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Execution History</h3>
        <p className="text-xs text-muted-foreground">
          No autonomous swaps executed yet
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Execution History</h3>
        <span className="text-[10px] text-muted-foreground font-mono">
          {confirmed.length} swap{confirmed.length !== 1 ? "s" : ""} executed
        </span>
      </div>

      <div className="relative space-y-0">
        {/* Timeline line */}
        <div className="absolute left-3 top-4 bottom-4 w-px bg-border" />

        {confirmed.map((trade, i) => {
          const [from, to] = trade.pair.split("/");
          return (
            <div key={trade.id} className="relative flex gap-3 py-3">
              {/* Timeline dot */}
              <div
                className={cn(
                  "relative z-10 flex items-center justify-center size-6 rounded-full shrink-0",
                  i === 0
                    ? "bg-emerald-100 text-emerald-600"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {i === 0 ? (
                  <Zap className="size-3" />
                ) : (
                  <CheckCircle2 className="size-3" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 text-sm">
                    <Bot className="size-3 text-muted-foreground" />
                    <span className="font-mono font-medium">{from}</span>
                    <ArrowRight className="size-3 text-muted-foreground" />
                    <span className="font-mono font-medium">{to}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatTimeAgo(trade.timestamp)}
                  </span>
                </div>

                <div className="flex items-center gap-3 mt-1 text-xs">
                  <span className="font-mono text-muted-foreground">
                    {trade.amountIn} {from} → {trade.amountOut} {to}
                  </span>
                  <span className="font-mono text-emerald-600">
                    +{trade.spreadPct.toFixed(2)}%
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-1.5">
                  {trade.approvalTxHash && (
                    <a
                      href={`https://celoscan.io/tx/${trade.approvalTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="size-2.5" />
                      Approval
                    </a>
                  )}
                  {trade.swapTxHash && (
                    <a
                      href={`https://celoscan.io/tx/${trade.swapTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="size-2.5" />
                      Swap
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
