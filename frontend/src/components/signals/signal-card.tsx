import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MarketTag } from "./market-tag";
import { formatTimeAgo, formatCurrency, formatPercent } from "@/lib/format";
import type { Signal } from "@/lib/types";
import { TrendingUp, TrendingDown, Minus, Lock, Sparkles } from "lucide-react";
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
  const dir = directionConfig[signal.direction];
  const Icon = dir.icon;
  const isNew = Date.now() - signal.timestamp < 60 * 60 * 1000; // Last hour

  return (
    <Card className="gap-0 py-0 overflow-hidden">
      <CardHeader className="pb-3 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MarketTag market={signal.market} />
            <CardTitle className="text-base">{signal.asset}</CardTitle>
            {signal.tier === "premium" && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-0.5">
                <Sparkles className="size-2.5" />
                PRO
              </span>
            )}
            {isNew && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                NEW
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
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
            <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
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

          {signal.tier === "premium" && signal.entryPrice ? (
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-muted-foreground">
                Entry {formatCurrency(signal.entryPrice)}
              </span>
              <span className="text-emerald-600">
                TP {formatCurrency(signal.targetPrice!)}
              </span>
              <span className="text-red-600">
                SL {formatCurrency(signal.stopLoss!)}
              </span>
            </div>
          ) : signal.tier === "free" && !signal.entryPrice ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="size-3" />
              <span>Premium for targets</span>
            </div>
          ) : null}
        </div>

        {signal.reasoning && (
          <div className="border-t pt-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {signal.reasoning}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
