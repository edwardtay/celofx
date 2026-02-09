"use client";

import { useTrades } from "@/hooks/use-trades";
import { useSignals } from "@/hooks/use-signals";
import { formatTimeAgo } from "@/lib/format";
import {
  CheckCircle2,
  BarChart3,
  Zap,
  ExternalLink,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

interface ActivityItem {
  id: string;
  type: "trade" | "signal" | "scan";
  label: string;
  detail: string;
  timestamp: number;
  link?: string;
  color: string;
}

export function ActivityFeed() {
  const { data: trades } = useTrades();
  const { data: signals } = useSignals();

  const activities = useMemo(() => {
    const items: ActivityItem[] = [];

    // Add trades
    if (trades?.length) {
      for (const trade of trades.filter((t) => t.status === "confirmed")) {
        items.push({
          id: `trade-${trade.id}`,
          type: "trade",
          label: `Swapped ${trade.pair}`,
          detail: `${trade.amountIn} → ${trade.amountOut} (+${trade.spreadPct.toFixed(2)}%)`,
          timestamp: trade.timestamp,
          link: trade.swapTxHash
            ? `https://celoscan.io/tx/${trade.swapTxHash}`
            : undefined,
          color: "text-emerald-600",
        });
      }
    }

    // Add signals (group by timestamp to avoid flooding)
    if (signals?.length) {
      // Group signals by approximate time (within 5 min)
      const groups = new Map<number, typeof signals>();
      for (const sig of signals) {
        const bucket = Math.floor(sig.timestamp / 300_000) * 300_000;
        const group = groups.get(bucket) ?? [];
        group.push(sig);
        groups.set(bucket, group);
      }

      for (const [bucket, sigs] of groups) {
        const mentoCount = sigs.filter((s) => s.market === "mento").length;
        items.push({
          id: `scan-${bucket}`,
          type: "scan",
          label: `Generated ${sigs.length} signals`,
          detail: mentoCount > 0
            ? `${mentoCount} Mento FX + ${sigs.length - mentoCount} market`
            : `Across ${new Set(sigs.map((s) => s.market)).size} markets`,
          timestamp: bucket,
          color: "text-blue-600",
        });
      }
    }

    return items.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
  }, [trades, signals]);

  if (activities.length === 0) return null;

  const iconMap = {
    trade: CheckCircle2,
    signal: BarChart3,
    scan: Zap,
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Bot className="size-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Recent Activity</h2>
      </div>
      <div className="space-y-1">
        {activities.map((item) => {
          const Icon = iconMap[item.type];
          return (
            <div
              key={item.id}
              className="flex items-center justify-between py-1.5 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Icon className={cn("size-3 shrink-0", item.color)} />
                <span className="font-medium truncate">{item.label}</span>
                <span className="text-muted-foreground truncate">{item.detail}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-muted-foreground">
                  {formatTimeAgo(item.timestamp)}
                </span>
                {item.link && (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="size-2.5" />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
