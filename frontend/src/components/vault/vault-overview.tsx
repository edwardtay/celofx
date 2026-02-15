"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Vault,
  TrendingUp,
  Users,
  Coins,
  ArrowRight,
  Activity,
} from "lucide-react";
import Link from "next/link";
import type { VaultMetrics } from "@/lib/types";
import { getCachedTrades } from "@/lib/local-cache";
import { Sparkline } from "./sparkline";
import { cn } from "@/lib/utils";

interface PricePoint {
  timestamp: number;
  price: number;
}

export function VaultOverview() {
  const [metrics, setMetrics] = useState<VaultMetrics | null>(null);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [latestTrade, setLatestTrade] = useState<{
    pair: string;
    pnl: number;
    timeAgo: string;
  } | null>(null);
  const [highlight, setHighlight] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const fetchVault = useCallback(() => {
    fetch("/api/vault")
      .then((r) => r.json())
      .then((d) => {
        setMetrics(d.metrics);
        if (d.priceHistory) setPriceHistory(d.priceHistory);
      })
      .catch(() => {});
  }, []);

  const updateLatestTrade = useCallback(() => {
    const trades = getCachedTrades().filter((t) => t.status === "confirmed");
    if (trades.length > 0) {
      const sorted = [...trades].sort((a, b) => b.timestamp - a.timestamp);
      const latest = sorted[0];
      const mins = Math.floor((Date.now() - latest.timestamp) / 60_000);
      const timeAgo =
        mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`;
      setLatestTrade({
        pair: latest.pair,
        pnl: latest.pnl ?? 0,
        timeAgo,
      });
    }
  }, []);

  useEffect(() => {
    const initial = setTimeout(() => {
      fetchVault();
      updateLatestTrade();
    }, 0);
    const interval = setInterval(() => {
      fetchVault();
      updateLatestTrade();
    }, 15_000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [fetchVault, updateLatestTrade]);

  // Listen for live trade events from AgentStatus
  useEffect(() => {
    const handleTradeExecuted = () => {
      fetchVault();
      updateLatestTrade();
      // Flash highlight animation
      setHighlight(true);
      setTimeout(() => setHighlight(false), 2000);
    };
    window.addEventListener("celofx:trade-executed", handleTradeExecuted);
    return () => window.removeEventListener("celofx:trade-executed", handleTradeExecuted);
  }, [fetchVault, updateLatestTrade]);

  if (!metrics) return null;

  const appreciation =
    metrics.sharePrice > 1
      ? ((metrics.sharePrice - 1) * 100).toFixed(2)
      : "0.00";

  return (
    <Card ref={cardRef} className={cn("gap-0 py-0 transition-all duration-700", highlight && "ring-2 ring-emerald-400 shadow-lg shadow-emerald-100")}>
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Vault className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Hedging Vault</span>
            <Badge
              variant="outline"
              className="gap-1 text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
            >
              <TrendingUp className="size-2.5" />
              {metrics.apyEstimate.toFixed(1)}% APY
            </Badge>
          </div>
          <Link
            href="/vault"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            Deposit / Withdraw <ArrowRight className="size-3" />
          </Link>
        </div>

        {/* Hero: sparkline + key stats side by side */}
        <div className="flex items-stretch gap-4">
          {/* Sparkline — the visual anchor */}
          {priceHistory.length >= 2 && (
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1.5 mb-1">
                <span className="text-lg font-mono font-bold">
                  ${metrics.sharePrice.toFixed(4)}
                </span>
                <span className="text-xs font-mono text-emerald-600">
                  +{appreciation}%
                </span>
                <span className="text-[10px] text-muted-foreground">
                  share price
                </span>
              </div>
              <Sparkline
                data={priceHistory}
                width={400}
                height={56}
                showArea
                className="w-full"
              />
            </div>
          )}

          {/* Compact stats */}
          <div className="grid grid-cols-1 gap-2 shrink-0 w-32">
            <div className="border rounded-lg p-2 space-y-0.5">
              <div className="flex items-center gap-1 text-[9px] text-muted-foreground uppercase tracking-wider">
                <Coins className="size-2" />
                TVL
              </div>
              <p className="text-sm font-mono font-bold">
                ${metrics.tvl.toFixed(0)}
              </p>
            </div>
            <div className="border rounded-lg p-2 space-y-0.5">
              <div className="flex items-center gap-1 text-[9px] text-muted-foreground uppercase tracking-wider">
                <Vault className="size-2" />
                Earned
              </div>
              <p className="text-sm font-mono font-bold text-emerald-600">
                +${metrics.cumulativePnl.toFixed(2)}
              </p>
            </div>
            <div className="border rounded-lg p-2 space-y-0.5">
              <div className="flex items-center gap-1 text-[9px] text-muted-foreground uppercase tracking-wider">
                <Users className="size-2" />
                Depositors
              </div>
              <p className="text-sm font-mono font-bold">
                {metrics.depositors}
              </p>
            </div>
          </div>
        </div>

        {latestTrade && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground border-t pt-2">
            <Activity className="size-3 text-emerald-500" />
            <span>
              Latest trade:{" "}
              <span className="font-mono font-medium text-foreground">
                {latestTrade.pair}
              </span>{" "}
              <span
                className={`font-mono ${
                  latestTrade.pnl >= 0
                    ? "text-emerald-600"
                    : "text-red-600"
                }`}
              >
                {latestTrade.pnl >= 0 ? "+" : ""}
                {latestTrade.pnl.toFixed(2)}%
              </span>{" "}
              spread captured {latestTrade.timeAgo}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
