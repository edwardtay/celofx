"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatAddress } from "@/lib/format";
import { createPublicClient, http, formatUnits } from "viem";
import { celo } from "viem/chains";
import { MENTO_TOKENS } from "@/config/contracts";
import { Wallet, ExternalLink, Bot } from "lucide-react";

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

export function AgentWallet() {
  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [celoBalance, setCeloBalance] = useState<string>("0");
  const [tradeCount, setTradeCount] = useState<number>(0);
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
          fetch("/api/trades").then((r) => r.json()).catch(() => []),
        ]);

        setBalances(tokenResults);
        setCeloBalance(parseFloat(formatUnits(nativeBalance, 18)).toFixed(4));
        setTradeCount(
          Array.isArray(tradesRes)
            ? tradesRes.filter(
                (t: { status: string }) => t.status === "confirmed"
              ).length
            : 0
        );
      } catch {
        // Silently fail — balances will show 0
      } finally {
        setLoading(false);
      }
    }

    fetchBalances();
  }, []);

  const latestSwapHash =
    "0x9978b5be04f1641ef99c98caa3115ca4654a77fbb7e4bdffef87ae045fb9d808";

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

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
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
                <p className="text-sm font-mono font-medium">{tradeCount}</p>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end">
          <a
            href={`https://celoscan.io/tx/${latestSwapHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Latest swap on Celoscan
            <ExternalLink className="size-2.5" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
