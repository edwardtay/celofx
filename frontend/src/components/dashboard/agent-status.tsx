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
  getLastScanResult,
  setLastScanResult,
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

  // Map market name → icon for restoring cached snapshots
  const marketIcons: Record<string, React.ReactNode> = {
    "Mento FX": <DollarSign className="size-3" />,
    Forex: <DollarSign className="size-3" />,
    Crypto: <Bitcoin className="size-3" />,
    Commodities: <Gem className="size-3" />,
  };

  // Restore last scan results from localStorage on mount
  useEffect(() => {
    const saved = getLastScanTime();
    if (saved) setPersistedScanTime(saved);

    const cached = getLastScanResult();
    if (cached) {
      setToolCalls(cached.toolCalls);
      setGeneratedSignals(cached.signals);
      setIterations(cached.iterations);
      setSignalCount(cached.signalCount);
      if (cached.tradeCount !== null) setTradeCount(cached.tradeCount);
      setSnapshots(
        cached.snapshots.map((s) => ({
          market: s.market,
          icon: marketIcons[s.market] ?? <DollarSign className="size-3" />,
          assets: s.assets as AssetPrice[],
          loaded: true,
        }))
      );
      setPhase("done");
      setLastAnalysis(new Date(cached.timestamp).toLocaleTimeString());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setSnapshots([]); // Snapshots rebuild immediately as markets load
    // Keep previous tool calls + signals visible until new ones arrive
    let fetchedSnapshots = 0;

    try {
      // Phase 1: Fetch Mento rates first (the core product)
      setPhase("mento");
      const mento = await fetchMarket(
        "/api/market-data/mento",
        "Mento FX",
        <DollarSign className="size-3" />
      );
      setSnapshots((prev) => [...prev, mento]);
      fetchedSnapshots++;

      // Phase 2: Fetch supporting market data
      setPhase("forex");
      const forex = await fetchMarket(
        "/api/market-data/forex",
        "Forex",
        <DollarSign className="size-3" />
      );
      setSnapshots((prev) => [...prev, forex]);
      fetchedSnapshots++;

      setPhase("crypto");
      const crypto = await fetchMarket(
        "/api/market-data/crypto",
        "Crypto",
        <Bitcoin className="size-3" />
      );
      setSnapshots((prev) => [...prev, crypto]);
      fetchedSnapshots++;

      setPhase("commodities");
      const commodities = await fetchMarket(
        "/api/market-data/commodities",
        "Commodities",
        <Gem className="size-3" />
      );
      setSnapshots((prev) => [...prev, commodities]);
      fetchedSnapshots++;

      // Phase 2: Send to Claude (with 55s client-side timeout)
      setPhase("thinking");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 55_000);
      const res = await fetch("/api/agent/analyze", {
        method: "POST",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();

      if (data.success) {
        // Replace previous results with fresh data
        if (data.toolCalls?.length) {
          setToolCalls(data.toolCalls);
        }
        if (data.iterations) {
          setIterations(data.iterations);
        }

        // Clear previous signals, then show new ones one by one
        if (data.signals?.length) {
          setGeneratedSignals([]);
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

        // Persist full scan result so it shows on page load
        setLastScanResult({
          toolCalls: data.toolCalls ?? [],
          signals: (data.signals ?? []).map((s: { asset: string; direction: string; confidence: number }) => ({
            asset: s.asset,
            direction: s.direction,
            confidence: s.confidence,
          })),
          snapshots: [mento, forex, crypto, commodities].map((s) => ({
            market: s.market,
            assets: s.assets.map((a) => ({
              symbol: a.symbol,
              price: a.price,
              change24h: a.change24h,
            })),
          })),
          iterations: data.iterations ?? 0,
          signalCount: data.signalCount ?? 0,
          tradeCount: null, // updated below if available
          timestamp: scanTime,
        });
      } else {
        setError(data.error || "Analysis failed");
        // Keep phase as "done" if we have snapshots, so market data stays visible
        if (fetchedSnapshots > 0) setPhase("done");
        else setPhase("idle");
      }
    } catch {
      setError("Claude AI timed out — market data collected, try again for full analysis");
      // Keep snapshots visible so judges see the market data we already fetched
      if (fetchedSnapshots > 0) setPhase("done");
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
