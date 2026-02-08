"use client";

import { useQuery } from "@tanstack/react-query";
import type { AssetPrice } from "@/lib/types";

function useMarket(market: string) {
  return useQuery<AssetPrice[]>({
    queryKey: ["market-data", market],
    queryFn: async () => {
      const res = await fetch(`/api/market-data/${market}`);
      if (!res.ok) throw new Error(`Failed to fetch ${market} data`);
      return res.json();
    },
    refetchInterval: 60_000,
  });
}

export function useCryptoData() {
  return useMarket("crypto");
}

export function useStockData() {
  return useMarket("stocks");
}

export function useForexData() {
  return useMarket("forex");
}

export function useCommodityData() {
  return useMarket("commodities");
}
