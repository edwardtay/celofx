"use client";

import { useReputationSummary } from "@/hooks/use-agent-profile";
import { Star, ShieldCheck } from "lucide-react";
import Link from "next/link";

export function ReputationBadge() {
  const { data: summary, isLoading } = useReputationSummary();

  const onChainCount = summary
    ? Number((summary as [bigint, bigint, number])[0])
    : 0;
  const summaryValue = summary
    ? Number((summary as [bigint, bigint, number])[1])
    : 0;
  const summaryDecimals = summary
    ? Number((summary as [bigint, bigint, number])[2])
    : 0;

  if (isLoading || onChainCount === 0) return null;

  const avgValue =
    summaryValue / Math.pow(10, summaryDecimals) / onChainCount;
  const avgStars = Math.round(avgValue / 20);

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
