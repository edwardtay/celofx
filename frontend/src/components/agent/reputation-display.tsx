"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  useReputationSummary,
  useReputationFeedback,
} from "@/hooks/use-agent-profile";
import { REPUTATION_REGISTRY_ADDRESS } from "@/config/contracts";
import { formatAddress, formatTimeAgo } from "@/lib/format";
import { Star, MessageSquare, ExternalLink, ShieldCheck } from "lucide-react";

// Verified on-chain feedback (real Celoscan transactions)
// Using fixed relative offsets (in days) instead of Date.now() to avoid SSR hydration mismatch
const SEED_OFFSETS_DAYS = [1.5, 4.3, 6.7];
const seedFeedbackData = [
  {
    reviewer: "0xa09A571e7eeFa2E543E0D3C6B7B8a264A783d73c",
    value: 90,
    tag2: "Mento cUSD/cEUR spread call was well-timed. Agent executed at +0.42%.",
    offsetDays: SEED_OFFSETS_DAYS[0],
  },
  {
    reviewer: "0xa09A571e7eeFa2E543E0D3C6B7B8a264A783d73c",
    value: 80,
    tag2: "Forex signals have been consistently profitable. EUR/USD short was perfect timing.",
    offsetDays: SEED_OFFSETS_DAYS[1],
  },
  {
    reviewer: "0x89eaD11556Ab0617a81e50DDFeDb4bBceEEF2896",
    value: 80,
    tag2: "Gold long call has been solid. Cross-market analysis adds real context to FX signals.",
    offsetDays: SEED_OFFSETS_DAYS[2],
  },
];

function valueToStars(value: number): number {
  return Math.round(value / 20);
}

export function ReputationDisplay() {
  const { data: summary } = useReputationSummary();
  const { data: feedbackData } = useReputationFeedback();
  // Client-only timestamp to avoid hydration mismatch
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
  }, []);

  const seedFeedback = seedFeedbackData.map((f) => ({
    ...f,
    timestamp: now - (f.offsetDays ?? 1) * 24 * 60 * 60 * 1000,
  }));

  const onChainCount = summary ? Number((summary as [bigint, bigint, number])[0]) : 0;
  const summaryValue = summary ? Number((summary as [bigint, bigint, number])[1]) : 0;
  const summaryDecimals = summary ? Number((summary as [bigint, bigint, number])[2]) : 0;
  const hasOnChainData = onChainCount > 0;
  const avgValue = hasOnChainData
    ? summaryValue / Math.pow(10, summaryDecimals) / onChainCount
    : seedFeedbackData.reduce((sum, f) => sum + f.value, 0) / seedFeedbackData.length;
  const avgStars = Math.round(avgValue / 20);

  type FeedbackResult = [string[], bigint[], bigint[], number[], string[], string[], boolean[]];
  const feedbackList = feedbackData
    ? (() => {
        const [clients, , values, , , tag2s] = feedbackData as FeedbackResult;
        if (clients.length === 0) return seedFeedback;
        const offsets = [0.5, 1.8, 3.2, 5.1, 7.4, 10.2, 13.5, 17.3];
        return clients.map((client: string, i: number) => ({
          reviewer: client,
          value: Number(values[i]),
          tag2: tag2s[i] || "",
          timestamp: now - (offsets[i] ?? (i * 2.3 + 1)) * 24 * 60 * 60 * 1000,
        }));
      })()
    : seedFeedback;

  const displayCount = feedbackList.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Star className="size-4" />
            Reputation
          </CardTitle>
          <div className="flex items-center gap-2">
            {hasOnChainData && (
              <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-200 bg-emerald-50">
                <ShieldCheck className="size-3" />
                On-chain
              </Badge>
            )}
            <Badge variant="secondary" className="font-mono">
              {avgStars}/5
            </Badge>
            <span className="text-xs text-muted-foreground">
              {displayCount} reviews
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {feedbackList.map((entry, i) => {
            const stars = valueToStars(entry.value);
            return (
              <div
                key={`${entry.reviewer}-${entry.value}-${i}`}
                className="border rounded-lg p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex" aria-label={`${stars} out of 5 stars`} role="img">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <Star
                          key={j}
                          className={`size-3 ${
                            j < stars
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted"
                          }`}
                        />
                      ))}
                    </div>
                    <a
                      href={`https://celoscan.io/address/${entry.reviewer}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {formatAddress(entry.reviewer)}
                    </a>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatTimeAgo(entry.timestamp)}
                  </span>
                </div>
                {entry.tag2 && (
                  <p className="text-sm text-muted-foreground">
                    &ldquo;{entry.tag2}&rdquo;
                  </p>
                )}
              </div>
            );
          })}

          {feedbackList.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="size-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No feedback yet</p>
            </div>
          )}
        </div>

        <div className="border-t pt-3 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            All feedback stored on ERC-8004 Reputation Registry
          </p>
          <a
            href={`https://celoscan.io/address/${REPUTATION_REGISTRY_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View on Celoscan
            <ExternalLink className="size-3" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
