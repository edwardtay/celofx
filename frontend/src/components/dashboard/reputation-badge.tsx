"use client";

import { useReputationFeedback } from "@/hooks/use-agent-profile";
import { Star, ShieldCheck } from "lucide-react";
import Link from "next/link";

export function ReputationBadge() {
  const { data: feedback } = useReputationFeedback();

  let onChainCount = 0;
  let avgStars = 4;

  if (feedback) {
    try {
      type FeedbackResult = [string[], bigint[], bigint[], number[], string[], string[], boolean[]];
      const [, , values, decimals] = feedback as FeedbackResult;
      onChainCount = values.length;
      if (onChainCount > 0) {
        let totalScore = 0;
        for (let i = 0; i < values.length; i++) {
          totalScore += Number(values[i]) / Math.pow(10, Number(decimals[i]));
        }
        avgStars = Math.round(totalScore / onChainCount / 20);
      }
    } catch {
      // Keep defaults
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
