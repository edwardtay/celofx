"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatAddress } from "@/lib/format";
import { createPublicClient, http, formatUnits } from "viem";
import { celo } from "viem/chains";
import { MENTO_TOKENS } from "@/config/contracts";
import {
  Wallet,
  ExternalLink,
  Bot,
  TrendingUp,
  ArrowRightLeft,
  BarChart3,
  Activity,
  ChevronRight,
} from "lucide-react";
import type { Trade } from "@/lib/types";

// Execution wallet — holds stablecoins and executes Mento swaps
const AGENT_ADDRESS = "0x6652AcDc623b7CCd52E115161d84b949bAf3a303" as const;

const erc20Abi = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

const client = createPublicClient({
  chain: celo,
  transport: http("https://forno.celo.org"),
});

interface TokenBalance {
  symbol: string;
  balance: string;
  raw: number;
}

interface TradeStats {
  tradeCount: number;
  totalVolume: number;
  avgSpread: number;
  cumulativePnl: number;
  latestSwapHash: string | null;
  trades: Trade[];
}

export function AgentWallet() {
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [celoBalance, setCeloBalance] = useState<string>("0");
  const [stats, setStats] = useState<TradeStats>({
    tradeCount: 0,
    totalVolume: 0,
    avgSpread: 0,
    cumulativePnl: 0,
    latestSwapHash: null,
    trades: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchBalances() {
      try {
        const tokens = [
          { symbol: "cUSD", address: MENTO_TOKENS.cUSD },
          { symbol: "cEUR", address: MENTO_TOKENS.cEUR },
          { symbol: "cREAL", address: MENTO_TOKENS.cREAL },
        ] as const;

        const [tokenResults, nativeBalance, tradesRes] = await Promise.all([
          Promise.all(
            tokens.map(async (token) => {
              const raw = await client.readContract({
                address: token.address as `0x${string}`,
                abi: erc20Abi,
                functionName: "balanceOf",
                args: [AGENT_ADDRESS],
              });
              const parsed = parseFloat(formatUnits(raw, 18));
              return {
                symbol: token.symbol,
                balance: parsed.toFixed(4),
                raw: parsed,
              };
            })
          ),
          client.getBalance({ address: AGENT_ADDRESS }),
          fetch("/api/trades")
            .then((r) => r.json())
            .catch(() => []),
        ]);

        setBalances(tokenResults);
        setCeloBalance(parseFloat(formatUnits(nativeBalance, 18)).toFixed(4));

        if (Array.isArray(tradesRes)) {
          const confirmed = tradesRes.filter(
            (t: Trade) => t.status === "confirmed"
          );
          const totalVolume = confirmed.reduce(
            (sum: number, t: Trade) => sum + parseFloat(t.amountIn),
            0
          );
          const avgSpread =
            confirmed.length > 0
              ? confirmed.reduce(
                  (sum: number, t: Trade) => sum + t.spreadPct,
                  0
                ) / confirmed.length
              : 0;
          const cumulativePnl = confirmed.reduce(
            (sum: number, t: Trade) => sum + (t.pnl ?? 0),
            0
          );
          const sorted = [...confirmed].sort(
            (a: Trade, b: Trade) => b.timestamp - a.timestamp
          );
          setStats({
            tradeCount: confirmed.length,
            totalVolume,
            avgSpread,
            cumulativePnl,
            latestSwapHash: sorted[0]?.swapTxHash ?? null,
            trades: sorted,
          });
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    fetchBalances();
  }, []);

  const allStablecoinsZero = balances.every((b) => b.raw === 0);

  return (
    <Card className="gap-0 py-0">
      <CardContent className="py-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Wallet className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Agent Wallet</span>
            <Badge
              variant="outline"
              className="gap-1 text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
            >
              <Bot className="size-2.5" />
              Autonomous
            </Badge>
          </div>
          <a
            href={`https://celoscan.io/address/${AGENT_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
          >
            {formatAddress(AGENT_ADDRESS)}
            <ExternalLink className="size-3" />
          </a>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <p className="text-xs text-muted-foreground py-2">Unable to load wallet data — Celo RPC may be slow. Refresh to retry.</p>
        ) : (
          <>
            {/* Primary stats — what the agent has DONE */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="border rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider">
                  <Activity className="size-2.5" />
                  Swaps Executed
                </div>
                <p className="text-xl font-mono font-bold">{stats.tradeCount}</p>
                <p className="text-[10px] text-muted-foreground">on-chain confirmed</p>
              </div>
              <div className="border rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider">
                  <TrendingUp className="size-2.5" />
                  Spread Captured
                </div>
                <p className={`text-xl font-mono font-bold ${stats.cumulativePnl >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {stats.cumulativePnl >= 0 ? "+" : ""}{stats.cumulativePnl.toFixed(2)}%
                </p>
                <p className="text-[10px] text-muted-foreground">across all trades</p>
              </div>
              <div className="border rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider">
                  <BarChart3 className="size-2.5" />
                  Volume Traded
                </div>
                <p className="text-xl font-mono font-bold">${stats.totalVolume.toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground">total swapped</p>
              </div>
              <div className="border rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider">
                  <ArrowRightLeft className="size-2.5" />
                  Avg Spread
                </div>
                <p className="text-xl font-mono font-bold text-emerald-600">
                  +{stats.avgSpread.toFixed(2)}%
                </p>
                <p className="text-[10px] text-muted-foreground">captured per swap</p>
              </div>
            </div>

            {/* Recent trades — clickable proof */}
            {stats.trades.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  Recent Swaps
                </p>
                <div className="space-y-1">
                  {stats.trades.slice(0, 3).map((trade) => (
                    <a
                      key={trade.id}
                      href={`https://celoscan.io/tx/${trade.swapTxHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex items-center gap-2 text-xs">
                        <ChevronRight className="size-3 text-emerald-500" />
                        <span className="font-mono font-medium">{trade.pair}</span>
                        <span className="text-muted-foreground">
                          {trade.amountIn} → {trade.amountOut}
                        </span>
                        {trade.pnl !== undefined && (
                          <span className={`font-mono ${trade.pnl >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {trade.pnl >= 0 ? "+" : ""}{trade.pnl.toFixed(2)}%
                          </span>
                        )}
                      </div>
                      <ExternalLink className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Wallet holdings — secondary, smaller */}
            <div className="border-t pt-2 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground">Holdings:</span>
                {balances.map((token) => (
                  <span key={token.symbol} className="font-mono">
                    <span className="text-muted-foreground">{token.symbol}</span>{" "}
                    {token.balance}
                  </span>
                ))}
                <span className="font-mono">
                  <span className="text-muted-foreground">CELO</span>{" "}
                  {celoBalance}
                </span>
                {allStablecoinsZero && stats.tradeCount > 0 && (
                  <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                    All capital rotated through swaps
                  </span>
                )}
              </div>
              {stats.latestSwapHash && (
                <a
                  href={`https://celoscan.io/tx/${stats.latestSwapHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Latest swap
                  <ExternalLink className="size-2.5" />
                </a>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
