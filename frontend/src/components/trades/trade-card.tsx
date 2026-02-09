"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatTimeAgo } from "@/lib/format";
import type { Trade } from "@/lib/types";
import { CheckCircle2, XCircle, Clock, ExternalLink, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const statusConfig = {
  confirmed: {
    icon: CheckCircle2,
    label: "Confirmed",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-l-emerald-500",
  },
  failed: {
    icon: XCircle,
    label: "Failed",
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-l-red-500",
  },
  pending: {
    icon: Clock,
    label: "Pending",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-l-amber-500",
  },
};

export function TradeCard({ trade }: { trade: Trade }) {
  const config = statusConfig[trade.status];
  const Icon = config.icon;

  return (
    <Card className={cn("gap-0 py-0 overflow-hidden border-l-4", config.border)}>
      <CardHeader className="pb-3 pt-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <CardTitle className="text-base truncate">{trade.pair}</CardTitle>
            <Badge
              variant="outline"
              className={cn("gap-1 font-mono text-xs", config.color, config.bg)}
            >
              <Icon className="size-3" />
              {config.label}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatTimeAgo(trade.timestamp)}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pb-4 pt-0 space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono">{trade.amountIn} {trade.fromToken}</span>
          <ArrowRight className="size-3.5 text-muted-foreground" />
          <span className="font-mono">
            {trade.status === "failed" ? "—" : `${trade.amountOut} ${trade.toToken}`}
          </span>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-muted-foreground">
              Rate {trade.rate.toFixed(4)}
            </span>
            <span className={cn(
              trade.spreadPct > 0 ? "text-emerald-600" : "text-red-600"
            )}>
              {trade.spreadPct > 0 ? "+" : ""}{trade.spreadPct.toFixed(2)}% spread
            </span>
            {trade.pnl !== undefined && (
              <span className={cn(
                "font-semibold",
                trade.pnl >= 0 ? "text-emerald-600" : "text-red-600"
              )}>
                {trade.pnl >= 0 ? "+" : ""}{trade.pnl.toFixed(2)}% P&L
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {trade.swapTxHash && (
              <a
                href={`https://celoscan.io/tx/${trade.swapTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="size-3" />
                Celoscan
              </a>
            )}
          </div>
        </div>

        {trade.error && (
          <div className="border-t pt-3">
            <p className="text-xs text-red-600 leading-relaxed">{trade.error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
