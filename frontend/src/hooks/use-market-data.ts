"use client";

import { useQuery } from "@tanstack/react-query";
import type { AssetPrice } from "@/lib/types";
import type { MentoRate } from "@/lib/market-data";

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

export function useMentoData() {
  return useQuery<MentoRate[]>({
    queryKey: ["market-data", "mento"],
    queryFn: async () => {
      const res = await fetch("/api/market-data/mento");
      if (!res.ok) throw new Error("Failed to fetch Mento data");
      return res.json();
    },
    refetchInterval: 30_000,
  });
}

export function useCryptoData() {
  return useMarket("crypto");
}

export function useForexData() {
  return useMarket("forex");
}

export function useCommodityData() {
  return useMarket("commodities");
}

export interface CrossVenueRate {
  pair: string;
  mentoRate: number | null;
  uniswapRate: number | null;
  forexRate: number;
  venueSpread: number | null;
  mentoVsForex: number | null;
  uniswapVsForex: number | null;
  bestVenue: "mento" | "uniswap" | "tied";
}

export function useCrossVenueData() {
  return useQuery<{ rates: CrossVenueRate[]; timestamp: number; venues: string[] }>({
    queryKey: ["market-data", "cross-venue"],
    queryFn: async () => {
      const res = await fetch("/api/market-data/cross-venue");
      if (!res.ok) throw new Error("Failed to fetch cross-venue data");
      return res.json();
    },
    refetchInterval: 30_000,
  });
}
