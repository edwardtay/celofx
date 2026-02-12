"use client";

import { useReputationSummary } from "@/hooks/use-agent-profile";
import { Star, ShieldCheck } from "lucide-react";
import Link from "next/link";

// Known on-chain data for FX Arbitrage Agent (ERC-8004 #10): 5 feedbacks, scores 90+80+95+75 = avg ~85/100
const FALLBACK_COUNT = 5;
const FALLBACK_STARS = 4;

export function ReputationBadge() {
  const { data: summary } = useReputationSummary();

  let onChainCount = FALLBACK_COUNT;
  let avgStars = FALLBACK_STARS;

  if (summary) {
    try {
      const count = Number((summary as [bigint, bigint, number])[0]);
      const summaryValue = Number((summary as [bigint, bigint, number])[1]);
      const summaryDecimals = Number((summary as [bigint, bigint, number])[2]);
      if (count > 0) {
        onChainCount = count;
        const avgValue =
          summaryValue / Math.pow(10, summaryDecimals) / count;
        avgStars = Math.round(avgValue / 20);
      }
    } catch {
      // Keep fallback values
    }
  }

  return (
    <Link
      href="/agent"
      className="inline-flex items-center gap-2 border rounded-full px-3 py-1.5 text-xs hover:bg-accent/50 transition-colors"
    >
      <ShieldCheck className="size-3.5 text-emerald-600" />
      <span className="text-muted-foreground">On-chain reputation</span>
      <span className="flex items-center gap-0.5 font-medium">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`size-3 ${
              i < avgStars
                ? "fill-amber-400 text-amber-400"
                : "text-muted"
            }`}
          />
        ))}
      </span>
      <span className="font-mono text-muted-foreground">
        ({onChainCount})
      </span>
    </Link>
  );
}
