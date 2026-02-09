"use client";

import { useQuery } from "@tanstack/react-query";
import type { Trade, TradeStatus } from "@/lib/types";

export function useTrades(status?: TradeStatus) {
  return useQuery<Trade[]>({
    queryKey: ["trades", status],
    queryFn: async () => {
      const params = status ? `?status=${status}` : "";
      const res = await fetch(`/api/trades${params}`);
      if (!res.ok) throw new Error("Failed to fetch trades");
      return res.json();
    },
    refetchInterval: 30_000,
  });
}
