"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  History,
  ExternalLink,
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  ChevronRight,
} from "lucide-react";
import { formatAddress } from "@/lib/format";

interface ClassifiedTx {
  hash: string;
  from: string;
  to: string;
  timestamp: number;
  success: boolean;
  type: string;
  blockNumber: string;
}

interface TokenTransfer {
  hash: string;
  tokenSymbol: string;
  from: string;
  to: string;
  value: string;
  timestamp: number;
}

interface AgentHistory {
  address: string;
  totalTxs: number;
  swapCount: number;
  successRate: number;
  transactions: ClassifiedTx[];
  tokenTransfers: TokenTransfer[];
  blockscoutUrl: string;
}

function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function OnchainHistory() {
  const [data, setData] = useState<AgentHistory | null>(null);

  useEffect(() => {
    fetch("/api/agent-history")
      .then((r) => r.json())
      .then((d) => {
        if (d.transactions) setData(d);
      })
      .catch(() => {});
  }, []);

  if (!data) return null;

  const typeBadge = (type: string) => {
    switch (type) {
      case "swap":
        return (
          <Badge
            variant="outline"
            className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200"
          >
            Swap
          </Badge>
        );
      case "approval":
        return (
          <Badge
            variant="outline"
            className="text-[9px] bg-blue-50 text-blue-700 border-blue-200"
          >
            Approve
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[9px]">
            {type}
          </Badge>
        );
    }
  };

  return (
    <Card className="gap-0 py-0">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">On-Chain History</span>
            <Badge
              variant="outline"
              className="text-[10px] bg-blue-50 text-blue-700 border-blue-200"
            >
              Blockscout
            </Badge>
          </div>
          <a
            href={data.blockscoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            Explorer <ExternalLink className="size-2.5" />
          </a>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="border rounded-lg p-2.5 space-y-0.5">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Total Txs
            </div>
            <p className="text-lg font-mono font-bold">{data.totalTxs}</p>
          </div>
          <div className="border rounded-lg p-2.5 space-y-0.5">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider">
              <ArrowRightLeft className="size-2" />
              Swaps
            </div>
            <p className="text-lg font-mono font-bold">{data.swapCount}</p>
          </div>
          <div className="border rounded-lg p-2.5 space-y-0.5">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Success Rate
            </div>
            <p className="text-lg font-mono font-bold text-emerald-600">
              {data.successRate}%
            </p>
          </div>
        </div>

        {/* Recent transactions */}
        {data.transactions.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
              Recent Transactions (Blockscout verified)
            </p>
            <div className="space-y-1">
              {data.transactions.slice(0, 6).map((tx) => (
                <a
                  key={tx.hash}
                  href={`https://explorer.celo.org/mainnet/tx/${tx.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-2 text-xs min-w-0">
                    <ChevronRight className="size-3 text-muted-foreground shrink-0" />
                    {tx.success ? (
                      <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />
                    ) : (
                      <XCircle className="size-3 text-red-500 shrink-0" />
                    )}
                    <span className="font-mono text-muted-foreground">
                      {formatAddress(tx.hash)}
                    </span>
                    {typeBadge(tx.type)}
                    <span className="text-muted-foreground text-[10px]">
                      {timeAgo(tx.timestamp)}
                    </span>
                  </div>
                  <ExternalLink className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Token transfers */}
        {data.tokenTransfers.length > 0 && (
          <div className="space-y-1.5 border-t pt-2">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
              Token Transfers
            </p>
            <div className="flex flex-wrap gap-2">
              {data.tokenTransfers.slice(0, 5).map((t, i) => (
                <a
                  key={`${t.hash}-${i}`}
                  href={`https://explorer.celo.org/mainnet/tx/${t.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs border rounded px-2 py-1 hover:bg-muted/50 transition-colors"
                >
                  <span className="font-mono font-medium">
                    {t.value} {t.tokenSymbol}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {timeAgo(t.timestamp)}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
