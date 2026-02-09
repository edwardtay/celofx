"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatAddress } from "@/lib/format";
import { createPublicClient, http, formatUnits } from "viem";
import { celo } from "viem/chains";
import { MENTO_TOKENS } from "@/config/contracts";
import { Wallet, ExternalLink, Bot, TrendingUp, Clock } from "lucide-react";
import type { Trade } from "@/lib/types";

const AGENT_ADDRESS = "0x1e67A381c93F34afAed8c1A7E5E35746f8bE2b23" as const;

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
}

interface TradeStats {
  tradeCount: number;
  totalVolume: number;
  avgSpread: number;
  cumulativePnl: number;
  latestSwapHash: string | null;
  oldestTradeTime: number | null;
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
    oldestTradeTime: null,
  });
  const [loading, setLoading] = useState(true);

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
              return {
                symbol: token.symbol,
                balance: parseFloat(formatUnits(raw, 18)).toFixed(4),
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
          const oldest = [...confirmed].sort(
            (a: Trade, b: Trade) => a.timestamp - b.timestamp
          );
          setStats({
            tradeCount: confirmed.length,
            totalVolume,
            avgSpread,
            cumulativePnl,
            latestSwapHash: sorted[0]?.swapTxHash ?? null,
            oldestTradeTime: oldest[0]?.timestamp ?? null,
          });
        }
      } catch {
        // Silently fail — balances will show 0
      } finally {
        setLoading(false);
      }
    }

    fetchBalances();
  }, []);

  return (
    <Card className="gap-0 py-0">
      <CardContent className="py-4 space-y-3">
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
            {!loading && stats.oldestTradeTime && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="size-2.5" />
                Live since {new Date(stats.oldestTradeTime).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
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

        <div className="grid grid-cols-3 sm:grid-cols-7 gap-3">
          {loading ? (
            Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="h-10 bg-muted rounded-lg animate-pulse"
              />
            ))
          ) : (
            <>
              {balances.map((token) => (
                <div key={token.symbol} className="text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {token.symbol}
                  </p>
                  <p className="text-sm font-mono font-medium">
                    {token.balance}
                  </p>
                </div>
              ))}
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  CELO
                </p>
                <p className="text-sm font-mono font-medium">{celoBalance}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Trades
                </p>
                <p className="text-sm font-mono font-medium">
                  {stats.tradeCount}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Volume
                </p>
                <p className="text-sm font-mono font-medium">
                  ${stats.totalVolume.toFixed(2)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Spread
                </p>
                <p className="text-sm font-mono font-medium text-emerald-600">
                  +{stats.avgSpread.toFixed(2)}%
                </p>
              </div>
            </>
          )}
        </div>

        {!loading && stats.cumulativePnl > 0 && (
          <div className="flex items-center justify-between border-t pt-2">
            <div className="flex items-center gap-1.5 text-xs">
              <TrendingUp className="size-3 text-emerald-600" />
              <span className="text-muted-foreground">Cumulative P&L:</span>
              <span className="font-mono font-semibold text-emerald-600">
                +{stats.cumulativePnl.toFixed(2)}%
              </span>
              <span className="text-muted-foreground">
                across {stats.tradeCount} trades
              </span>
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
        )}
      </CardContent>
    </Card>
  );
}
