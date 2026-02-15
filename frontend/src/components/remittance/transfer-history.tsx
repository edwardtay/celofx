"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  History,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  FileText,
} from "lucide-react";
import {
  getRemittanceHistory,
  type RemittanceTransaction,
} from "@/lib/remittance-store";

function timeAgo(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface Props {
  refreshKey: number;
  onViewReceipt: (tx: RemittanceTransaction) => void;
}

export function TransferHistory({ refreshKey, onViewReceipt }: Props) {
  const [history, setHistory] = useState<RemittanceTransaction[]>([]);

  useEffect(() => {
    const t = setTimeout(() => setHistory(getRemittanceHistory()), 0);
    return () => clearTimeout(t);
  }, [refreshKey]);

  if (history.length === 0) return null;

  const totalSent = history
    .filter((t) => t.status === "executed")
    .reduce((s, t) => s + t.amount, 0);
  const totalSaved = history
    .filter((t) => t.status === "executed")
    .reduce((s, t) => s + parseFloat(t.savingsAmount || "0"), 0);

  return (
    <Card className="gap-0 py-0">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Transfer History</span>
            <Badge variant="outline" className="text-[10px]">
              {history.length} transfers
            </Badge>
          </div>
          {totalSent > 0 && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>
                Sent:{" "}
                <span className="font-mono font-medium text-foreground">
                  ${totalSent.toFixed(0)}
                </span>
              </span>
              {totalSaved > 0 && (
                <span>
                  Saved:{" "}
                  <span className="font-mono font-medium text-emerald-600">
                    ${totalSaved.toFixed(2)}
                  </span>
                </span>
              )}
            </div>
          )}
        </div>

        <div className="space-y-1">
          {history.slice(0, 8).map((tx) => (
            <button
              key={tx.id}
              onClick={() => onViewReceipt(tx)}
              className="w-full flex items-center justify-between py-2 px-2.5 rounded hover:bg-muted/50 transition-colors group text-left"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {tx.status === "executed" ? (
                  <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                ) : tx.status === "failed" ? (
                  <XCircle className="size-3.5 text-red-500 shrink-0" />
                ) : (
                  <Clock className="size-3.5 text-amber-500 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm">
                    <span className="font-mono font-medium">
                      {tx.amount} {tx.fromToken}
                    </span>
                    <span className="text-muted-foreground text-xs">→</span>
                    <span className="font-mono">
                      {tx.amountOut} {tx.toToken}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1.5 py-0"
                    >
                      {tx.corridor}
                    </Badge>
                    {tx.recipientCountry && (
                      <span className="flex items-center gap-0.5">
                        <MapPin className="size-2" />
                        {tx.recipientCountry}
                      </span>
                    )}
                    <span>{timeAgo(tx.timestamp)}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {tx.status === "executed" && parseFloat(tx.savingsAmount) > 0 && (
                  <span className="text-[10px] font-mono text-emerald-600">
                    saved ${tx.savingsAmount}
                  </span>
                )}
                {tx.txHash ? (
                  <a
                    href={`https://celoscan.io/tx/${tx.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="size-3" />
                  </a>
                ) : (
                  <FileText className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
