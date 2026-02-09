"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { MarketTag } from "./market-tag";
import { formatTimeAgo, formatCurrency } from "@/lib/format";
import type { Signal } from "@/lib/types";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  ShieldAlert,
  Sparkles,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";

const directionConfig = {
  long: { icon: TrendingUp, label: "Long", color: "text-emerald-600", bg: "bg-emerald-50" },
  short: { icon: TrendingDown, label: "Short", color: "text-red-600", bg: "bg-red-50" },
  hold: { icon: Minus, label: "Hold", color: "text-amber-600", bg: "bg-amber-50" },
};

export function SignalDetailModal({
  signal,
  open,
  onOpenChange,
}: {
  signal: Signal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!signal) return null;

  const dir = directionConfig[signal.direction];
  const Icon = dir.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <MarketTag market={signal.market} />
            <DialogTitle className="text-lg">{signal.asset}</DialogTitle>
            {signal.tier === "premium" && (
              <span className="text-[10px] font-semibold font-mono px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-0.5">
                <Sparkles className="size-2.5" />
                PRO
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Direction + Confidence */}
          <div className="flex items-center justify-between">
            <Badge
              variant="outline"
              className={cn("gap-1 font-mono text-sm px-3 py-1", dir.color, dir.bg)}
            >
              <Icon className="size-4" />
              {dir.label}
            </Badge>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Confidence</span>
              <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full",
                    signal.confidence >= 75
                      ? "bg-emerald-500"
                      : signal.confidence >= 60
                        ? "bg-amber-500"
                        : "bg-red-500"
                  )}
                  style={{ width: `${signal.confidence}%` }}
                />
              </div>
              <span className="text-sm font-mono font-semibold">
                {signal.confidence}%
              </span>
            </div>
          </div>

          {/* Summary */}
          <div>
            <p className="text-sm leading-relaxed">{signal.summary}</p>
          </div>

          {/* Entry/Target/Stop */}
          {signal.entryPrice && (
            <div className="grid grid-cols-3 gap-3">
              <div className="border rounded-lg p-2.5 text-center">
                <p className="text-[10px] text-muted-foreground mb-1">Entry</p>
                <p className="text-sm font-mono font-semibold">
                  {formatCurrency(signal.entryPrice)}
                </p>
              </div>
              <div className="border rounded-lg p-2.5 text-center border-emerald-200 bg-emerald-50/50">
                <p className="text-[10px] text-emerald-600 mb-1 flex items-center justify-center gap-0.5">
                  <Target className="size-2.5" />
                  Target
                </p>
                <p className="text-sm font-mono font-semibold text-emerald-600">
                  {signal.targetPrice ? formatCurrency(signal.targetPrice) : "—"}
                </p>
              </div>
              <div className="border rounded-lg p-2.5 text-center border-red-200 bg-red-50/50">
                <p className="text-[10px] text-red-600 mb-1 flex items-center justify-center gap-0.5">
                  <ShieldAlert className="size-2.5" />
                  Stop Loss
                </p>
                <p className="text-sm font-mono font-semibold text-red-600">
                  {signal.stopLoss ? formatCurrency(signal.stopLoss) : "—"}
                </p>
              </div>
            </div>
          )}

          {/* Reasoning */}
          {signal.reasoning && (
            <div className="border rounded-lg p-3 space-y-1.5 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground">AI Reasoning</p>
              <p className="text-sm leading-relaxed">{signal.reasoning}</p>
            </div>
          )}

          {/* Meta */}
          <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
            <div className="flex items-center gap-1.5">
              <Bot className="size-3" />
              Agent #4 · ERC-8004
            </div>
            <span>{formatTimeAgo(signal.timestamp)}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
