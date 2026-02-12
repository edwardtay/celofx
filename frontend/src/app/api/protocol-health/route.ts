import { NextResponse } from "next/server";

// DeFiLlama API — free, no key needed
const DEFILLAMA_API = "https://api.llama.fi";

let cache: { data: unknown; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 min

export async function GET() {
  try {
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      return NextResponse.json(cache.data);
    }

    // Fetch Mento protocol data from DeFiLlama
    const [mentoRes, celoTvlRes] = await Promise.all([
      fetch(`${DEFILLAMA_API}/protocol/mento`).then((r) => r.json()),
      fetch(`${DEFILLAMA_API}/v2/chains`).then((r) => r.json()),
    ]);

    // Mento protocol TVL
    const mentoTvl = mentoRes.currentChainTvls?.Celo ?? mentoRes.tvl ?? 0;
    const mentoCategory = mentoRes.category ?? "Stablecoins";

    // Celo chain TVL
    const celoChain = Array.isArray(celoTvlRes)
      ? celoTvlRes.find((c: { name: string }) => c.name === "Celo")
      : null;
    const celoTvl = celoChain?.tvl ?? 0;

    // TVL history for trend (last 7 data points from Mento)
    const tvlHistory: { date: number; totalLiquidityUSD: number }[] =
      mentoRes.tvl ?? [];
    const recentTvl = tvlHistory.slice(-8);
    const tvl7dAgo = recentTvl.length >= 7 ? recentTvl[0]?.totalLiquidityUSD ?? 0 : 0;
    const tvlNow = recentTvl.length > 0 ? recentTvl[recentTvl.length - 1]?.totalLiquidityUSD ?? 0 : 0;
    const tvlChange7d =
      tvl7dAgo > 0 ? ((tvlNow - tvl7dAgo) / tvl7dAgo) * 100 : 0;

    // Chains Mento is deployed on
    const chains: string[] = mentoRes.chains ?? ["Celo"];

    const result = {
      mento: {
        tvl: typeof mentoTvl === "number" ? mentoTvl : tvlNow,
        category: mentoCategory,
        chains,
        tvlChange7d: parseFloat(tvlChange7d.toFixed(2)),
        url: mentoRes.url ?? "https://mento.org",
      },
      celo: {
        tvl: celoTvl,
        name: "Celo",
      },
      mentoShareOfCelo:
        celoTvl > 0
          ? parseFloat(
              (((typeof mentoTvl === "number" ? mentoTvl : tvlNow) / celoTvl) * 100).toFixed(2)
            )
          : 0,
      timestamp: Date.now(),
    };

    cache = { data: result, timestamp: Date.now() };
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to fetch protocol data",
      },
      { status: 500 }
    );
  }
}
