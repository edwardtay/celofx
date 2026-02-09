"use client";

import { useQuery } from "@tanstack/react-query";
import type { Trade, TradeStatus } from "@/lib/types";
import {
  getCachedTrades,
  setCachedTrades,
  mergeTrades,
} from "@/lib/local-cache";

export function useTrades(status?: TradeStatus) {
  return useQuery<Trade[]>({
    queryKey: ["trades", status],
    queryFn: async () => {
      const params = status ? `?status=${status}` : "";
      const res = await fetch(`/api/trades${params}`);
      if (!res.ok) throw new Error("Failed to fetch trades");
      const apiTrades: Trade[] = await res.json();

      // Merge with localStorage (restores trades lost to cold starts)
      const cached = getCachedTrades();
      const merged = mergeTrades(apiTrades, cached);

      // Persist for next cold start
      setCachedTrades(merged);

      // Apply status filter to merged results
      if (status) {
        return merged.filter((t) => t.status === status);
      }
      return merged;
    },
    initialData: () => {
      const cached = getCachedTrades();
      if (cached.length === 0) return undefined;
      if (status) return cached.filter((t) => t.status === status);
      return cached;
    },
    refetchInterval: 30_000,
  });
}
