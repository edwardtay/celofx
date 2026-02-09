"use client";

import { useQuery } from "@tanstack/react-query";
import type { Signal, MarketType } from "@/lib/types";

export function useSignals(market?: MarketType) {
  return useQuery<Signal[]>({
    queryKey: ["signals", market],
    queryFn: async () => {
      const params = market ? `?market=${market}` : "";
      const res = await fetch(`/api/signals${params}`);
      if (!res.ok) throw new Error("Failed to fetch signals");
      return res.json();
    },
    refetchInterval: 30_000,
  });
}
