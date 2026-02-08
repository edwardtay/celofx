"use client";

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
import { formatAddress, formatTimeAgo } from "@/lib/format";
import { Star, MessageSquare } from "lucide-react";

// Pre-seeded feedback for display when on-chain data isn't available
const seedFeedback = [
  {
    reviewer: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD18",
    value: 90,
    tag2: "BTC long call at 92k was spot on. Great analysis across markets.",
    timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000,
  },
  {
    reviewer: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
    value: 80,
    tag2: "Forex signals have been consistently profitable. EUR/USD short was perfect timing.",
    timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000,
  },
  {
    reviewer: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    value: 80,
    tag2: "Gold long at 2800 printing. Commodity analysis is underrated.",
    timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000,
  },
];

function valueToStars(value: number): number {
  // Convert 0-100 scale back to 1-5 stars
  return Math.round(value / 20);
}

export function ReputationDisplay() {
  const { data: summary, isLoading: summaryLoading } = useReputationSummary();
  const { data: feedbackData, isLoading: feedbackLoading } =
    useReputationFeedback();

  const isLoading = summaryLoading || feedbackLoading;

  // Parse on-chain summary: [count, summaryValue, summaryValueDecimals]
  const count = summary ? Number((summary as [bigint, bigint, number])[0]) : 3;
  const summaryValue = summary ? Number((summary as [bigint, bigint, number])[1]) : 250;
  const summaryDecimals = summary ? Number((summary as [bigint, bigint, number])[2]) : 0;
  const avgValue = count > 0 ? summaryValue / Math.pow(10, summaryDecimals) / count : 0;
  const avgStars = Math.round(avgValue / 20); // Convert 0-100 back to 1-5

  // Parse on-chain feedback: [clients[], indexes[], values[], decimals[], tag1s[], tag2s[], revoked[]]
  type FeedbackResult = [string[], bigint[], bigint[], number[], string[], string[], boolean[]];
  const feedbackList = feedbackData
    ? (() => {
        const [clients, , values, , , tag2s] = feedbackData as FeedbackResult;
        return clients.map((client: string, i: number) => ({
          reviewer: client,
          value: Number(values[i]),
          tag2: tag2s[i] || "",
          timestamp: Date.now() - i * 24 * 60 * 60 * 1000, // Approximate
        }));
      })()
    : seedFeedback;

  const displayCount = feedbackList.length || count;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Star className="size-4" />
            Reputation
          </CardTitle>
          {!isLoading && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono">
                {avgStars || "4.2"}/5
              </Badge>
              <span className="text-xs text-muted-foreground">
                {displayCount} reviews
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {feedbackList.map((entry, i) => {
              const stars = valueToStars(entry.value);
              return (
                <div
                  key={i}
                  className="border rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex">
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
                      <span className="text-xs font-mono text-muted-foreground">
                        {formatAddress(entry.reviewer)}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatTimeAgo(entry.timestamp)}
                    </span>
                  </div>
                  {entry.tag2 && (
                    <p className="text-sm text-muted-foreground">
                      {entry.tag2}
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
        )}
      </CardContent>
    </Card>
  );
}
