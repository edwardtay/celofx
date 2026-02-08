import type { AssetPrice } from "./types";

const cache = new Map<string, { data: unknown; expiry: number }>();
const CACHE_TTL = 60_000; // 60s

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expiry > Date.now()) return entry.data as T;
  return null;
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

export async function fetchCryptoPrices(): Promise<AssetPrice[]> {
  const cached = getCached<AssetPrice[]>("crypto");
  if (cached) return cached;

  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,celo&vs_currencies=usd&include_24hr_change=true",
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) throw new Error("CoinGecko API error");
    const data = await res.json();

    const prices: AssetPrice[] = [
      {
        symbol: "BTC",
        name: "Bitcoin",
        price: data.bitcoin?.usd ?? 97500,
        change24h: data.bitcoin?.usd_24h_change ?? 2.1,
      },
      {
        symbol: "ETH",
        name: "Ethereum",
        price: data.ethereum?.usd ?? 3400,
        change24h: data.ethereum?.usd_24h_change ?? 1.8,
      },
      {
        symbol: "SOL",
        name: "Solana",
        price: data.solana?.usd ?? 172,
        change24h: data.solana?.usd_24h_change ?? -0.5,
      },
      {
        symbol: "CELO",
        name: "Celo",
        price: data.celo?.usd ?? 0.62,
        change24h: data.celo?.usd_24h_change ?? 3.2,
      },
    ];
    setCache("crypto", prices);
    return prices;
  } catch {
    return [
      { symbol: "BTC", name: "Bitcoin", price: 97500, change24h: 2.1 },
      { symbol: "ETH", name: "Ethereum", price: 3400, change24h: 1.8 },
      { symbol: "SOL", name: "Solana", price: 172, change24h: -0.5 },
      { symbol: "CELO", name: "Celo", price: 0.62, change24h: 3.2 },
    ];
  }
}

export async function fetchForexRates(): Promise<AssetPrice[]> {
  const cached = getCached<AssetPrice[]>("forex");
  if (cached) return cached;

  try {
    const res = await fetch(
      "https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,GBP,JPY,CHF",
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) throw new Error("Frankfurter API error");
    const data = await res.json();

    const prices: AssetPrice[] = [
      {
        symbol: "EUR/USD",
        name: "Euro",
        price: data.rates?.EUR ? 1 / data.rates.EUR : 1.08,
        change24h: -0.12,
      },
      {
        symbol: "GBP/USD",
        name: "British Pound",
        price: data.rates?.GBP ? 1 / data.rates.GBP : 1.248,
        change24h: -0.25,
      },
      {
        symbol: "USD/JPY",
        name: "Japanese Yen",
        price: data.rates?.JPY ?? 152.3,
        change24h: 0.18,
      },
      {
        symbol: "USD/CHF",
        name: "Swiss Franc",
        price: data.rates?.CHF ?? 0.893,
        change24h: 0.05,
      },
    ];
    setCache("forex", prices);
    return prices;
  } catch {
    return [
      { symbol: "EUR/USD", name: "Euro", price: 1.08, change24h: -0.12 },
      { symbol: "GBP/USD", name: "British Pound", price: 1.248, change24h: -0.25 },
      { symbol: "USD/JPY", name: "Japanese Yen", price: 152.3, change24h: 0.18 },
      { symbol: "USD/CHF", name: "Swiss Franc", price: 0.893, change24h: 0.05 },
    ];
  }
}

export async function fetchStockPrices(): Promise<AssetPrice[]> {
  const cached = getCached<AssetPrice[]>("stocks");
  if (cached) return cached;

  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    return getStockFallback();
  }

  try {
    const symbols = ["AAPL", "NVDA", "TSLA", "MSFT"];
    const results = await Promise.all(
      symbols.map(async (sym) => {
        const res = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${sym}&token=${apiKey}`,
          { signal: AbortSignal.timeout(8000) }
        );
        if (!res.ok) return null;
        const d = await res.json();
        return { symbol: sym, price: d.c, change: d.dp };
      })
    );

    const prices: AssetPrice[] = results.map((r, i) => ({
      symbol: symbols[i],
      name: getStockName(symbols[i]),
      price: r?.price ?? getStockFallback()[i].price,
      change24h: r?.change ?? getStockFallback()[i].change24h,
    }));

    setCache("stocks", prices);
    return prices;
  } catch {
    return getStockFallback();
  }
}

function getStockName(symbol: string): string {
  const names: Record<string, string> = {
    AAPL: "Apple",
    NVDA: "NVIDIA",
    TSLA: "Tesla",
    MSFT: "Microsoft",
  };
  return names[symbol] ?? symbol;
}

function getStockFallback(): AssetPrice[] {
  return [
    { symbol: "AAPL", name: "Apple", price: 228.5, change24h: 0.42 },
    { symbol: "NVDA", name: "NVIDIA", price: 138.2, change24h: 3.15 },
    { symbol: "TSLA", name: "Tesla", price: 245.8, change24h: -1.23 },
    { symbol: "MSFT", name: "Microsoft", price: 415.6, change24h: 0.87 },
  ];
}

export function fetchCommodityPrices(): AssetPrice[] {
  return [
    { symbol: "XAU", name: "Gold", price: 2865, change24h: 0.85 },
    { symbol: "WTI", name: "Crude Oil", price: 71.2, change24h: -1.3 },
    { symbol: "XAG", name: "Silver", price: 31.8, change24h: 1.42 },
    { symbol: "NG", name: "Natural Gas", price: 3.12, change24h: -0.65 },
  ];
}
