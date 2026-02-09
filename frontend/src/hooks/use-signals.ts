"use client";

import { useQuery } from "@tanstack/react-query";
import type { Signal, MarketType } from "@/lib/types";
import {
  getCachedSignals,
  setCachedSignals,
  mergeSignals,
} from "@/lib/local-cache";

export function useSignals(market?: MarketType) {
  return useQuery<Signal[]>({
    queryKey: ["signals", market],
    queryFn: async () => {
      const params = market ? `?market=${market}` : "";
      const res = await fetch(`/api/signals${params}`);
      if (!res.ok) throw new Error("Failed to fetch signals");
      const apiSignals: Signal[] = await res.json();

      // Merge with localStorage (restores signals lost to cold starts)
      const cached = getCachedSignals();
      const merged = mergeSignals(apiSignals, cached);

      // Persist for next cold start
      setCachedSignals(merged);

      // Apply market filter to merged results
      if (market) {
        return merged.filter((s) => s.market === market);
      }
      return merged;
    },
    initialData: () => {
      const cached = getCachedSignals();
      if (cached.length === 0) return undefined;
      if (market) return cached.filter((s) => s.market === market);
      return cached;
    },
    refetchInterval: 30_000,
  });
}
