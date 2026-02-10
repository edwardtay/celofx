"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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
  DollarSign,
  Gem,
  Brain,
  TrendingUp,
  TrendingDown,
  Clock,
  Terminal,
  ChevronRight,
} from "lucide-react";
import { formatPercent } from "@/lib/format";
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
  const [elapsed, setElapsed] = useState(0);
  const terminalRef = useRef<HTMLDivElement>(null);
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

  // Elapsed time counter during analysis
  useEffect(() => {
    if (!analyzing) { setElapsed(0); return; }
    const start = Date.now();
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [analyzing]);

  // Auto-scroll terminal as tool calls stream in
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [toolCalls]);

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
      // Fetch all markets in parallel — each appears as it resolves
      setPhase("forex"); // Generic "fetching" phase
      const marketConfigs = [
        { url: "/api/market-data/mento", market: "Mento FX", icon: <DollarSign className="size-3" /> },
        { url: "/api/market-data/forex", market: "Forex", icon: <DollarSign className="size-3" /> },
        { url: "/api/market-data/crypto", market: "Crypto", icon: <Bitcoin className="size-3" /> },
        { url: "/api/market-data/commodities", market: "Commodities", icon: <Gem className="size-3" /> },
      ] as const;

      const marketPromises = marketConfigs.map(async (cfg) => {
        const result = await fetchMarket(cfg.url, cfg.market, cfg.icon);
        setSnapshots((prev) => [...prev, result]);
        fetchedSnapshots++;
        return result;
      });

      const [mento, forex, crypto, commodities] = await Promise.all(marketPromises);

      // Phase 3: Stream Claude analysis via SSE
      setPhase("thinking");
      // Clear previous tool calls to show fresh stream
      setToolCalls([]);
      setGeneratedSignals([]);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 55_000);
      const res = await fetch("/api/agent/analyze", {
        method: "POST",
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok || !res.body) {
        throw new Error("Analysis request failed");
      }

      // Parse SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalData: Record<string, unknown> | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Split on double newlines (SSE event delimiter)
        const parts = buffer.split("\n\n");
        buffer = parts.pop()!; // Keep incomplete part

        for (const part of parts) {
          if (!part.trim()) continue;
          const lines = part.split("\n");
          let eventType = "";
          let dataStr = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) eventType = line.slice(7);
            else if (line.startsWith("data: ")) dataStr = line.slice(6);
          }
          if (!eventType || !dataStr) continue;

          try {
            const parsed = JSON.parse(dataStr);

            if (eventType === "tool_call") {
              setToolCalls((prev) => [...prev, { tool: parsed.tool, summary: parsed.summary }]);
            } else if (eventType === "signal") {
              setGeneratedSignals((prev) => [
                ...prev,
                { asset: parsed.asset, direction: parsed.direction, confidence: parsed.confidence },
              ]);
            } else if (eventType === "iteration") {
              setIterations(parsed.iteration);
            } else if (eventType === "complete") {
              finalData = parsed;
            } else if (eventType === "error") {
              setError(parsed.error || "Analysis failed");
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      if (finalData && (finalData as { success?: boolean }).success) {
        const data = finalData as {
          success: boolean;
          signalCount: number;
          signals: Array<{ id: string; asset: string; direction: string; confidence: number } & Record<string, unknown>>;
          trades: Array<{ status: string } & Record<string, unknown>>;
          toolCalls: Array<{ tool: string; summary: string }>;
          iterations: number;
        };

        // Persist signals to localStorage
        if (data.signals?.length) {
          const cachedSigs = getCachedSignals();
          const merged = mergeSignals(data.signals as never[], cachedSigs);
          setCachedSignals(merged);

          queryClient.setQueryData<unknown[]>(
            ["signals", undefined],
            (old) => {
              const existing = (old ?? []) as Record<string, unknown>[];
              const existingIds = new Set(existing.map((s) => s.id));
              const newSignals = data.signals.filter(
                (s) => !existingIds.has(s.id)
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

        // Persist full scan result
        setLastScanResult({
          toolCalls: data.toolCalls ?? [],
          signals: (data.signals ?? []).map((s) => ({
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
          tradeCount: null,
          timestamp: scanTime,
        });
      } else if (!error) {
        // Stream ended without complete event
        setError("Analysis incomplete — try again");
        if (fetchedSnapshots > 0) setPhase("done");
        else setPhase("idle");
      }
    } catch {
      setError("Claude AI timed out — market data collected, try again for full analysis");
      if (fetchedSnapshots > 0) setPhase("done");
      else setPhase("idle");
    } finally {
      setAnalyzing(false);
    }
  };

  const phaseLabel: Record<AnalysisPhase, string> = {
    idle: "",
    mento: "Fetching market data...",
    crypto: "Fetching market data...",
    forex: "Fetching market data...",
    commodities: "Fetching market data...",
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
              <span className="text-sm font-medium">FX Arbitrage Agent</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-muted-foreground">Online</span>
            </div>
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-mono">
              Cron: every 15 min (Cloudflare)
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
                {elapsed > 0 && <span className="font-mono ml-1">{elapsed}s</span>}
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
            {phase === "thinking" && toolCalls.length === 0 && (
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
                    {analyzing && phase === "thinking" && (
                      <Loader2 className="size-2.5 animate-spin text-emerald-500" />
                    )}
                  </div>
                  {iterations && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {iterations} iteration{iterations !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div ref={terminalRef} className="bg-zinc-950 rounded-md p-2 font-mono text-[11px] space-y-0.5 max-h-32 overflow-y-auto">
                  {toolCalls.map((tc, i) => (
                    <div key={i} className="flex items-start gap-1.5 animate-in fade-in slide-in-from-left-2 duration-300">
                      <ChevronRight className="size-3 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-emerald-400">{tc.tool}</span>
                      <span className="text-zinc-500">→</span>
                      <span className="text-zinc-300 truncate">{tc.summary}</span>
                    </div>
                  ))}
                  {analyzing && phase === "thinking" && (
                    <div className="flex items-center gap-1.5 text-zinc-500">
                      <span className="animate-pulse">▌</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
