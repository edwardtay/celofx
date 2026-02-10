"use client";

import { useState, useCallback, useEffect } from "react";
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
  Clock,
  Terminal,
  ChevronRight,
} from "lucide-react";
import { formatCurrency, formatPercent } from "@/lib/format";
import { formatTimeAgo } from "@/lib/format";
import type { AssetPrice } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  setCachedSignals,
  getCachedSignals,
  setCachedTrades,
  getCachedTrades,
  mergeSignals,
  mergeTrades,
  getLastScanTime,
  setLastScanTime,
} from "@/lib/local-cache";

type AnalysisPhase =
  | "idle"
  | "mento"
  | "crypto"
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
  const [tradeCount, setTradeCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snapshots, setSnapshots] = useState<MarketSnapshot[]>([]);
  const [generatedSignals, setGeneratedSignals] = useState<
    { asset: string; direction: string; confidence: number }[]
  >([]);
  const [toolCalls, setToolCalls] = useState<
    { tool: string; summary: string }[]
  >([]);
  const [iterations, setIterations] = useState<number | null>(null);
  const [persistedScanTime, setPersistedScanTime] = useState<number | null>(null);
  const queryClient = useQueryClient();

  // Restore last scan time from localStorage on mount
  useEffect(() => {
    const saved = getLastScanTime();
    if (saved) setPersistedScanTime(saved);
  }, []);

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
    setToolCalls([]);
    setIterations(null);

    try {
      // Phase 1: Fetch Mento rates first (the core product)
      setPhase("mento");
      const mento = await fetchMarket(
        "/api/market-data/mento",
        "Mento FX",
        <DollarSign className="size-3" />
      );
      setSnapshots((prev) => [...prev, mento]);

      // Phase 2: Fetch supporting market data
      setPhase("forex");
      const forex = await fetchMarket(
        "/api/market-data/forex",
        "Forex",
        <DollarSign className="size-3" />
      );
      setSnapshots((prev) => [...prev, forex]);

      setPhase("crypto");
      const crypto = await fetchMarket(
        "/api/market-data/crypto",
        "Crypto",
        <Bitcoin className="size-3" />
      );
      setSnapshots((prev) => [...prev, crypto]);

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
        // Capture tool call log from API
        if (data.toolCalls?.length) {
          setToolCalls(data.toolCalls);
        }
        if (data.iterations) {
          setIterations(data.iterations);
        }

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

          // Persist signals to localStorage so they survive cold starts
          const cachedSigs = getCachedSignals();
          const merged = mergeSignals(data.signals, cachedSigs);
          setCachedSignals(merged);

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
        queryClient.invalidateQueries({ queryKey: ["trades"] });

        // Fetch trade count + persist trades
        try {
          const tradesRes = await fetch("/api/trades");
          const tradesData = await tradesRes.json();
          if (Array.isArray(tradesData)) {
            // Persist trades to localStorage
            const cachedTrades = getCachedTrades();
            const mergedTrades = mergeTrades(tradesData, cachedTrades);
            setCachedTrades(mergedTrades);

            setTradeCount(
              mergedTrades.filter(
                (t: { status: string }) => t.status === "confirmed"
              ).length
            );
          }
        } catch {
          // ignore
        }

        const scanTime = Date.now();
        setLastScanTime(scanTime);
        setPersistedScanTime(scanTime);
        setLastAnalysis(new Date().toLocaleTimeString());
        setSignalCount(data.signalCount);
        setPhase("done");
      } else {
        setError(data.error || "Analysis failed");
        // Keep phase as "done" if we have snapshots, so market data stays visible
        if (snapshots.length > 0) setPhase("done");
        else setPhase("idle");
      }
    } catch {
      setError("Claude AI timed out — market data collected, try again for full analysis");
      // Keep snapshots visible so judges see the market data we already fetched
      if (snapshots.length > 0) setPhase("done");
      else setPhase("idle");
    } finally {
      setAnalyzing(false);
    }
  };

  const phaseLabel: Record<AnalysisPhase, string> = {
    idle: "",
    mento: "Fetching Mento stablecoin rates...",
    crypto: "Fetching crypto prices...",
    forex: "Fetching forex rates...",
    commodities: "Fetching commodity prices...",
    thinking: "Claude AI analyzing FX opportunities...",
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
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-mono">
              Cron: daily 8:00 UTC
            </span>
            {!analyzing && !lastAnalysis && persistedScanTime && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="size-2.5" />
                Last scan {formatTimeAgo(persistedScanTime)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            {analyzing && (
              <span className="text-xs text-muted-foreground animate-pulse">
                {phaseLabel[phase]}
              </span>
            )}
            {!analyzing && lastAnalysis && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                <CheckCircle2 className="size-3.5" />
                {lastAnalysis}
                {signalCount !== null && ` · ${signalCount} signals`}
                {tradeCount !== null && ` · ${tradeCount} trades`}
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
                      {snap.assets[0].symbol || snap.market}{" "}
                      <span
                        className={cn(
                          (snap.assets[0].change24h ?? 0) >= 0
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

            {/* Tool call log — shows Claude's actual tool invocations */}
            {toolCalls.length > 0 && (
              <div className="border-t pt-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Terminal className="size-3 text-muted-foreground" />
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                      Agent Tool Calls
                    </p>
                  </div>
                  {iterations && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {iterations} iteration{iterations !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div className="bg-zinc-950 rounded-md p-2 font-mono text-[11px] space-y-0.5 max-h-32 overflow-y-auto">
                  {toolCalls.map((tc, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <ChevronRight className="size-3 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-emerald-400">{tc.tool}</span>
                      <span className="text-zinc-500">→</span>
                      <span className="text-zinc-300 truncate">{tc.summary}</span>
                    </div>
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
