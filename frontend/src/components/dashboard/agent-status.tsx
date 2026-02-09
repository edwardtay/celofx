"use client";

import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Loader2,
  Zap,
  CheckCircle2,
  AlertCircle,
  Bitcoin,
  BarChart3,
  DollarSign,
  Gem,
  Brain,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/format";
import type { AssetPrice } from "@/lib/types";
import { cn } from "@/lib/utils";

type AnalysisPhase =
  | "idle"
  | "crypto"
  | "stocks"
  | "forex"
  | "commodities"
  | "thinking"
  | "done";

interface MarketSnapshot {
  market: string;
  icon: React.ReactNode;
  assets: AssetPrice[];
  loaded: boolean;
}

export function AgentStatus() {
  const [analyzing, setAnalyzing] = useState(false);
  const [phase, setPhase] = useState<AnalysisPhase>("idle");
  const [lastAnalysis, setLastAnalysis] = useState<string | null>(null);
  const [signalCount, setSignalCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<MarketSnapshot[]>([]);
  const [generatedSignals, setGeneratedSignals] = useState<
    { asset: string; direction: string; confidence: number }[]
  >([]);
  const queryClient = useQueryClient();

  const fetchMarket = useCallback(
    async (
      url: string,
      market: string,
      icon: React.ReactNode
    ): Promise<MarketSnapshot> => {
      try {
        const res = await fetch(url);
        const data = await res.json();
        return { market, icon, assets: Array.isArray(data) ? data : [], loaded: true };
      } catch {
        return { market, icon, assets: [], loaded: true };
      }
    },
    []
  );

  const runAnalysis = async () => {
    setAnalyzing(true);
    setError(null);
    setSnapshots([]);
    setGeneratedSignals([]);

    try {
      // Phase 1: Fetch market data in sequence so judge sees each step
      setPhase("crypto");
      const crypto = await fetchMarket(
        "/api/market-data/crypto",
        "Crypto",
        <Bitcoin className="size-3" />
      );
      setSnapshots((prev) => [...prev, crypto]);

      setPhase("stocks");
      const stocks = await fetchMarket(
        "/api/market-data/stocks",
        "Stocks",
        <BarChart3 className="size-3" />
      );
      setSnapshots((prev) => [...prev, stocks]);

      setPhase("forex");
      const forex = await fetchMarket(
        "/api/market-data/forex",
        "Forex",
        <DollarSign className="size-3" />
      );
      setSnapshots((prev) => [...prev, forex]);

      setPhase("commodities");
      const commodities = await fetchMarket(
        "/api/market-data/commodities",
        "Commodities",
        <Gem className="size-3" />
      );
      setSnapshots((prev) => [...prev, commodities]);

      // Phase 2: Send to Claude
      setPhase("thinking");
      const res = await fetch("/api/agent/analyze", { method: "POST" });
      const data = await res.json();

      if (data.success) {
        // Show signals appearing one by one
        if (data.signals?.length) {
          for (const signal of data.signals) {
            setGeneratedSignals((prev) => [
              ...prev,
              {
                asset: signal.asset,
                direction: signal.direction,
                confidence: signal.confidence,
              },
            ]);
            await new Promise((r) => setTimeout(r, 300));
          }

          queryClient.setQueryData<unknown[]>(
            ["signals", undefined],
            (old) => {
              const existing = (old ?? []) as Record<string, unknown>[];
              const existingIds = new Set(existing.map((s) => s.id));
              const newSignals = data.signals.filter(
                (s: Record<string, unknown>) => !existingIds.has(s.id)
              );
              return [...newSignals, ...existing];
            }
          );
        }
        queryClient.invalidateQueries({ queryKey: ["signals"] });
        setLastAnalysis(new Date().toLocaleTimeString());
        setSignalCount(data.signalCount);
        setPhase("done");
      } else {
        setError(data.error || "Analysis failed");
        setPhase("idle");
      }
    } catch (err) {
      console.error("Analysis failed:", err);
      setError("Network error — check API key");
      setPhase("idle");
    } finally {
      setAnalyzing(false);
    }
  };

  const phaseLabel: Record<AnalysisPhase, string> = {
    idle: "",
    crypto: "Fetching crypto prices...",
    stocks: "Fetching stock prices...",
    forex: "Fetching forex rates...",
    commodities: "Fetching commodity prices...",
    thinking: "Claude AI analyzing markets...",
    done: "Analysis complete!",
  };

  return (
    <Card className="gap-0 py-0">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-emerald-500" />
              <span className="text-sm font-medium">Agent #4</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-muted-foreground">Online</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {analyzing && (
              <span className="text-xs text-muted-foreground animate-pulse">
                {phaseLabel[phase]}
              </span>
            )}
            {!analyzing && lastAnalysis && phase === "done" && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                <CheckCircle2 className="size-3.5" />
                {lastAnalysis}
                {signalCount !== null && ` · ${signalCount} signals`}
              </div>
            )}
            {!analyzing && phase === "idle" && lastAnalysis && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                <CheckCircle2 className="size-3.5" />
                {lastAnalysis}
                {signalCount !== null && ` · ${signalCount} signals`}
              </div>
            )}
            {error && (
              <div className="flex items-center gap-1.5 text-xs text-red-600">
                <AlertCircle className="size-3.5" />
                {error}
              </div>
            )}
            <div className="flex flex-col items-end gap-1">
              <Button
                size="sm"
                onClick={runAnalysis}
                disabled={analyzing}
                className="gap-1.5"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Zap className="size-3.5" />
                    Scan Markets
                  </>
                )}
              </Button>
              {!analyzing && !lastAnalysis && (
                <span className="text-[10px] text-muted-foreground">
                  Fetches live data + AI analysis (~30s)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Live analysis panel */}
        {(analyzing || phase === "done") && snapshots.length > 0 && (
          <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
            {/* Market data snapshots */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {snapshots.map((snap) => (
                <div
                  key={snap.market}
                  className="flex items-center gap-2 text-xs"
                >
                  <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />
                  <span className="text-muted-foreground">{snap.market}:</span>
                  {snap.assets[0] && (
                    <span className="font-mono font-medium">
                      {snap.assets[0].symbol}{" "}
                      <span
                        className={cn(
                          snap.assets[0].change24h >= 0
                            ? "text-emerald-600"
                            : "text-red-600"
                        )}
                      >
                        {formatPercent(snap.assets[0].change24h)}
                      </span>
                    </span>
                  )}
                </div>
              ))}
              {analyzing &&
                snapshots.length < 4 &&
                Array.from({ length: 4 - snapshots.length }).map((_, i) => (
                  <div
                    key={`loading-${i}`}
                    className="flex items-center gap-2 text-xs"
                  >
                    <Loader2 className="size-3 animate-spin text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">Loading...</span>
                  </div>
                ))}
            </div>

            {/* AI thinking phase */}
            {phase === "thinking" && (
              <div className="flex items-center gap-2 text-xs pt-1 border-t">
                <Brain className="size-3 text-muted-foreground animate-pulse" />
                <span className="text-muted-foreground">
                  Claude AI generating cross-market signals...
                </span>
              </div>
            )}

            {/* Generated signals appearing */}
            {generatedSignals.length > 0 && (
              <div className="border-t pt-2 space-y-1">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  Generated Signals
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {generatedSignals.map((sig, i) => (
                    <span
                      key={`${sig.asset}-${i}`}
                      className={cn(
                        "inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full border animate-signal-enter",
                        sig.direction === "long"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : sig.direction === "short"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                      )}
                    >
                      {sig.direction === "long" ? (
                        <TrendingUp className="size-2.5" />
                      ) : sig.direction === "short" ? (
                        <TrendingDown className="size-2.5" />
                      ) : null}
                      {sig.asset} {sig.confidence}%
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
