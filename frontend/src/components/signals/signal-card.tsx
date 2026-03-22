"use client";

import { useState } from "react";
import { SignalDetailModal } from "./signal-detail-modal";
import { formatTimeAgo } from "@/lib/format";
import type { Signal } from "@/lib/types";
import { TrendingUp, TrendingDown, Minus, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const directionConfig = {
  long: {
    icon: TrendingUp,
    label: "Long",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  short: {
    icon: TrendingDown,
    label: "Short",
    color: "text-red-600",
    bg: "bg-red-50",
  },
  hold: {
    icon: Minus,
    label: "Hold",
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
};

export function SignalCard({ signal }: { signal: Signal }) {
  const [modalOpen, setModalOpen] = useState(false);
  const dir = directionConfig[signal.direction];
  const Icon = dir.icon;

  return (
    <>
      <div
        className="flex items-center justify-between py-3 px-4 rounded-lg border hover:bg-accent/30 transition-colors cursor-pointer"
        onClick={() => setModalOpen(true)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setModalOpen(true); } }}
        role="button"
        tabIndex={0}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn("size-8 rounded-full flex items-center justify-center text-xs", dir.bg, dir.color)}>
            <Icon className="size-3.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{signal.asset}</span>
              <span className={cn("text-[10px] font-mono", dir.color)}>{dir.label}</span>
              {signal.tier === "premium" && <Sparkles className="size-2.5 text-amber-500" />}
            </div>
            <p className="text-[11px] text-muted-foreground truncate max-w-[300px]">{signal.summary}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-xs font-mono tabular-nums">{signal.confidence}%</span>
          {signal.market === "mento" && signal.entryPrice && signal.targetPrice && (
            <span className={cn("text-xs font-mono tabular-nums", signal.entryPrice > signal.targetPrice ? "text-emerald-600" : "text-red-600")}>
              {signal.entryPrice > signal.targetPrice ? "+" : ""}{(((signal.entryPrice - signal.targetPrice) / signal.targetPrice) * 100).toFixed(2)}%
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">{formatTimeAgo(signal.timestamp)}</span>
        </div>
      </div>

      <SignalDetailModal
        signal={signal}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </>
  );
}
