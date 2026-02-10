"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarketTag } from "./market-tag";
import { SignalDetailModal } from "./signal-detail-modal";
import { formatTimeAgo, formatCurrency } from "@/lib/format";
import type { Signal } from "@/lib/types";
import { TrendingUp, TrendingDown, Minus, Lock, Sparkles, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

const directionConfig = {
  long: {
    icon: TrendingUp,
    label: "Long",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-l-emerald-500",
  },
  short: {
    icon: TrendingDown,
    label: "Short",
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-l-red-500",
  },
  hold: {
    icon: Minus,
    label: "Hold",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-l-amber-500",
  },
};

export function SignalCard({ signal }: { signal: Signal }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const dir = directionConfig[signal.direction];
  const Icon = dir.icon;

  useEffect(() => {
    setIsNew(Date.now() - signal.timestamp < 60 * 60 * 1000);
  }, [signal.timestamp]);

  return (
    <>
      <Card
        className={cn("gap-0 py-0 overflow-hidden cursor-pointer hover:border-foreground/20 hover:shadow-md transition-all duration-200 border-l-4", dir.border)}
        onClick={() => setModalOpen(true)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setModalOpen(true); } }}
        role="button"
        tabIndex={0}
      >
        <CardHeader className="pb-3 pt-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <MarketTag market={signal.market} />
              <CardTitle className="text-base truncate">{signal.asset}</CardTitle>
              {signal.market === "mento" && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 flex items-center gap-0.5 shrink-0">
                  <Link2 className="size-2.5" />
                  On-chain
                </span>
              )}
              {signal.tier === "premium" && (
                <span className="text-[10px] font-semibold font-mono px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-0.5 shrink-0">
                  <Sparkles className="size-2.5" />
                  PRO
                </span>
              )}
              {isNew && (
                <span className="text-[10px] font-semibold font-mono px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                  NEW
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant="outline"
                className={cn("gap-1 font-mono text-xs", dir.color, dir.bg)}
              >
                <Icon className="size-3" />
                {dir.label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatTimeAgo(signal.timestamp)}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pb-4 pt-0 space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {signal.summary}
          </p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Confidence</span>
              <div
                className="w-20 h-2 rounded-full bg-muted overflow-hidden"
                role="progressbar"
                aria-valuenow={signal.confidence}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Confidence ${signal.confidence}%`}
              >
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
              <span className="text-xs font-mono font-medium">
                {signal.confidence}%
              </span>
            </div>

            {signal.market === "mento" && signal.entryPrice && signal.targetPrice ? (
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="text-muted-foreground">
                  Mento {signal.entryPrice.toFixed(4)}
                </span>
                <span className="text-muted-foreground">
                  Forex {signal.targetPrice.toFixed(4)}
                </span>
                <span className={cn(
                  "font-semibold",
                  signal.entryPrice > signal.targetPrice ? "text-emerald-600" : "text-red-600"
                )}>
                  {signal.entryPrice > signal.targetPrice ? "+" : ""}
                  {(((signal.entryPrice - signal.targetPrice) / signal.targetPrice) * 100).toFixed(2)}% spread
                </span>
              </div>
            ) : signal.entryPrice ? (
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="text-muted-foreground">
                  Entry {formatCurrency(signal.entryPrice)}
                </span>
                {signal.targetPrice && (
                  <span className="text-emerald-600">
                    TP {formatCurrency(signal.targetPrice)}
                  </span>
                )}
                {signal.stopLoss && (
                  <span className="text-red-600">
                    SL {formatCurrency(signal.stopLoss)}
                  </span>
                )}
              </div>
            ) : signal.tier === "premium" ? (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="size-3" />
                <span>Unlock for targets</span>
              </div>
            ) : null}
          </div>

          {signal.reasoning && (
            <div className="border-t pt-3">
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                {signal.reasoning}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <SignalDetailModal
        signal={signal}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </>
  );
}
