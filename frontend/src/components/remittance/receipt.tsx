"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Receipt,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Copy,
  Share2,
  MapPin,
  ArrowRight,
  X,
} from "lucide-react";
import { type RemittanceTransaction } from "@/lib/remittance-store";

interface Props {
  tx: RemittanceTransaction;
  onClose: () => void;
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TransferReceipt({ tx, onClose }: Props) {
  const statusIcon =
    tx.status === "executed" ? (
      <CheckCircle2 className="size-5 text-emerald-600" />
    ) : tx.status === "failed" ? (
      <XCircle className="size-5 text-red-500" />
    ) : (
      <Clock className="size-5 text-amber-500" />
    );

  const statusLabel =
    tx.status === "executed"
      ? "Confirmed"
      : tx.status === "failed"
        ? "Failed"
        : "Pending";

  const statusColor =
    tx.status === "executed"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : tx.status === "failed"
        ? "bg-red-50 text-red-700 border-red-200"
        : "bg-amber-50 text-amber-700 border-amber-200";

  const handleCopy = () => {
    const text = [
      `CeloFX Transfer Receipt`,
      `Date: ${formatTime(tx.timestamp)}`,
      `Corridor: ${tx.corridor}`,
      `Sent: ${tx.amount} ${tx.fromToken}`,
      `Received: ${tx.amountOut} ${tx.toToken}`,
      `Rate: ${tx.rate.toFixed(4)}`,
      `Fee: $${tx.fee} (0.1%)`,
      `Saved: $${tx.savingsAmount} vs ${tx.savingsVs}`,
      tx.txHash ? `Tx: https://celoscan.io/tx/${tx.txHash}` : "",
      tx.recipientCountry ? `Destination: ${tx.recipientCountry}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    navigator.clipboard.writeText(text);
  };

  const handleShare = () => {
    if (!navigator.share) {
      handleCopy();
      return;
    }
    navigator.share({
      title: "CeloFX Transfer Receipt",
      text: `Sent ${tx.amount} ${tx.fromToken} → ${tx.amountOut} ${tx.toToken} via CeloFX. Saved $${tx.savingsAmount} vs ${tx.savingsVs}.`,
      url: tx.txHash
        ? `https://celoscan.io/tx/${tx.txHash}`
        : undefined,
    });
  };

  return (
    <Card className="gap-0 py-0 border-2 border-dashed">
      <CardContent className="py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Transfer Receipt</span>
            <Badge variant="outline" className={`text-[10px] ${statusColor}`}>
              {statusLabel}
            </Badge>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent transition-colors text-muted-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Status + Amount */}
        <div className="flex items-center justify-center gap-3 py-2">
          {statusIcon}
          <div className="flex items-center gap-3">
            <div className="text-center">
              <p className="text-xl font-mono font-bold">
                {tx.amount} {tx.fromToken}
              </p>
              <p className="text-[10px] text-muted-foreground">Sent</p>
            </div>
            <ArrowRight className="size-4 text-muted-foreground" />
            <div className="text-center">
              <p className="text-xl font-mono font-bold text-emerald-600">
                {tx.amountOut} {tx.toToken}
              </p>
              <p className="text-[10px] text-muted-foreground">Received</p>
            </div>
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-b py-3">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Corridor
            </p>
            <p className="text-sm font-medium">{tx.corridor}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Date
            </p>
            <p className="text-sm">{formatTime(tx.timestamp)}</p>
          </div>
          {tx.recipientCountry && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Destination
              </p>
              <p className="text-sm flex items-center gap-1">
                <MapPin className="size-3" />
                {tx.recipientCountry}
              </p>
            </div>
          )}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Exchange Rate
            </p>
            <p className="text-sm font-mono">{tx.rate.toFixed(4)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Fee
            </p>
            <p className="text-sm font-mono text-emerald-600">${tx.fee} (0.1%)</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              You Saved
            </p>
            <p className="text-sm font-mono font-medium text-emerald-600">
              ${tx.savingsAmount} vs {tx.savingsVs}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Language
            </p>
            <p className="text-sm">
              {tx.language === "es"
                ? "Spanish"
                : tx.language === "pt"
                  ? "Portuguese"
                  : tx.language === "fr"
                    ? "French"
                    : "English"}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Original Request
            </p>
            <p className="text-sm text-muted-foreground italic truncate">
              &ldquo;{tx.message}&rdquo;
            </p>
          </div>
        </div>

        {/* Tx hash */}
        {tx.txHash && (
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Transaction
            </p>
            <a
              href={`https://celoscan.io/tx/${tx.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 transition-colors font-mono"
            >
              {tx.txHash.slice(0, 14)}...{tx.txHash.slice(-10)}
              <ExternalLink className="size-3" />
            </a>
            {tx.approvalHash && (
              <a
                href={`https://celoscan.io/tx/${tx.approvalHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
              >
                Approval: {tx.approvalHash.slice(0, 10)}...
                {tx.approvalHash.slice(-6)}
                <ExternalLink className="size-2.5" />
              </a>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg hover:bg-accent transition-colors"
          >
            <Copy className="size-3" />
            Copy Receipt
          </button>
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg hover:bg-accent transition-colors"
          >
            <Share2 className="size-3" />
            Share
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
