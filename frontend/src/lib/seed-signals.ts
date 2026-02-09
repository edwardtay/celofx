import type { Signal } from "./types";

const now = Date.now();
const h = (hours: number) => now - hours * 60 * 60 * 1000;

export const seedSignals: Signal[] = [
  // Crypto signals
  {
    id: "seed-1",
    market: "crypto",
    asset: "BTC/USD",
    direction: "long",
    confidence: 82,
    summary:
      "Bitcoin breaking above 200-day MA with increasing volume. Institutional inflows accelerating through spot ETFs.",
    reasoning:
      "On-chain metrics show accumulation phase. Exchange reserves at 3-year low while ETF inflows hit $1.2B weekly. RSI at 62 — room to run before overbought.",
    entryPrice: 97500,
    targetPrice: 108000,
    stopLoss: 93200,
    tier: "free",
    timestamp: h(2),
  },
  {
    id: "seed-2",
    market: "crypto",
    asset: "ETH/USD",
    direction: "long",
    confidence: 74,
    summary:
      "Ethereum showing relative strength as ETH/BTC ratio rebounds from multi-year support. Pectra upgrade catalyst ahead.",
    reasoning:
      "ETH/BTC bouncing off 0.032 support level held since 2021. Pectra upgrade improves staking UX, expected to reduce sell pressure. DeFi TVL recovering with $45B locked.",
    tier: "free",
    timestamp: h(5),
  },
  {
    id: "seed-3",
    market: "crypto",
    asset: "SOL/USD",
    direction: "short",
    confidence: 65,
    summary:
      "Solana facing resistance at $180. DEX volume declining while token unlocks approach. Risk/reward favors caution.",
    reasoning:
      "Weekly DEX volume dropped 30% from peak. 15M SOL unlock in March from early investors. Meme coin activity fading as driver. RSI divergence on daily chart.",
    tier: "free",
    timestamp: h(8),
  },
  {
    id: "seed-4",
    market: "crypto",
    asset: "CELO/USD",
    direction: "long",
    confidence: 71,
    summary:
      "Celo L2 migration driving developer activity. TVL up 40% month-over-month with stablecoin growth on-chain.",
    reasoning:
      "Mobile-first thesis gaining traction in emerging markets. cUSD supply expanding. Agent ecosystem (ERC-8004) adds unique utility layer.",
    entryPrice: 0.62,
    targetPrice: 0.85,
    stopLoss: 0.54,
    tier: "premium",
    timestamp: h(1),
  },
  // Stock signals
  {
    id: "seed-5",
    market: "stocks",
    asset: "NVDA",
    direction: "long",
    confidence: 78,
    summary:
      "NVIDIA earnings beat expectations. Data center revenue up 150% YoY. AI capex cycle still accelerating.",
    reasoning:
      "Blackwell architecture sold out through Q3. Hyperscaler capex guidance raised across MSFT, GOOG, AMZN. Forward P/E at 35x reasonable for 60%+ growth.",
    entryPrice: 138,
    targetPrice: 160,
    stopLoss: 125,
    tier: "free",
    timestamp: h(3),
  },
  {
    id: "seed-6",
    market: "stocks",
    asset: "AAPL",
    direction: "hold",
    confidence: 60,
    summary:
      "Apple trading at fair value. iPhone 17 cycle priced in. Wait for pullback to $210 for better entry.",
    reasoning:
      "Services revenue growing 14% but hardware flat. Apple Intelligence rollout slower than expected. P/E at 32x with single-digit earnings growth. Neutral until next catalyst.",
    tier: "free",
    timestamp: h(12),
  },
  {
    id: "seed-7",
    market: "stocks",
    asset: "TSLA",
    direction: "short",
    confidence: 68,
    summary:
      "Tesla deliveries missed estimates. EV competition intensifying in China. Valuation stretched at 80x forward earnings.",
    reasoning:
      "BYD outselling Tesla globally. Margin compression from price cuts. Robotaxi timeline remains uncertain. Support at $160.",
    entryPrice: 245,
    targetPrice: 180,
    stopLoss: 275,
    tier: "premium",
    timestamp: h(6),
  },
  // Forex signals
  {
    id: "seed-8",
    market: "forex",
    asset: "EUR/USD",
    direction: "short",
    confidence: 72,
    summary:
      "Dollar strengthening on hawkish Fed rhetoric. ECB cutting faster than expected. Yield differential widening.",
    reasoning:
      "US-EU 2-year yield spread at 200bps, widest since 2022. ECB cut 25bps with dovish guidance while Fed paused. EUR/USD broke below 1.08 support. DXY momentum bullish.",
    entryPrice: 1.078,
    targetPrice: 1.055,
    stopLoss: 1.092,
    tier: "free",
    timestamp: h(4),
  },
  {
    id: "seed-9",
    market: "forex",
    asset: "USD/JPY",
    direction: "long",
    confidence: 66,
    summary:
      "BOJ maintaining dovish stance despite inflation. Carry trade flows supporting dollar-yen above 150.",
    reasoning:
      "BOJ kept rates at 0.25%, signaling patience. US-Japan rate differential at 450bps fueling carry trade. MOF intervention risk above 155 limits upside. Range trade 150-155.",
    tier: "free",
    timestamp: h(10),
  },
  {
    id: "seed-10",
    market: "forex",
    asset: "GBP/USD",
    direction: "short",
    confidence: 63,
    summary:
      "Sterling under pressure from weak UK GDP data. BOE likely to cut rates in March. Cable testing 1.24 support.",
    reasoning:
      "UK economy stagnating while US remains resilient. Rate differential favors USD. Technical breakdown below 1.25 confirms bearish bias.",
    entryPrice: 1.248,
    targetPrice: 1.215,
    stopLoss: 1.262,
    tier: "premium",
    timestamp: h(7),
  },
  // Commodity signals
  {
    id: "seed-11",
    market: "commodities",
    asset: "Gold (XAU)",
    direction: "long",
    confidence: 85,
    summary:
      "Gold at all-time highs as central banks accelerate purchases. De-dollarization trend provides structural bid.",
    reasoning:
      "Central bank buying hit 1,037 tonnes in 2024, led by China and Poland. Real rates declining as Fed pivots. ETF inflows resuming. $3,000 target increasingly consensus.",
    entryPrice: 2865,
    targetPrice: 3050,
    stopLoss: 2780,
    tier: "free",
    timestamp: h(1),
  },
  {
    id: "seed-12",
    market: "commodities",
    asset: "Crude Oil (WTI)",
    direction: "short",
    confidence: 58,
    summary:
      "Oil demand outlook weakening as China slows. OPEC+ cuts offset by US shale production growth.",
    reasoning:
      "IEA downgraded 2025 demand growth to 1.1M bpd. US production at record 13.3M bpd. China PMI contractionary for 3rd month. OPEC+ compliance eroding. Low conviction — watch $65 support.",
    tier: "free",
    timestamp: h(9),
  },
  {
    id: "seed-13",
    market: "commodities",
    asset: "Silver (XAG)",
    direction: "long",
    confidence: 76,
    summary:
      "Silver benefiting from industrial demand (solar panels) and gold spillover. Gold/silver ratio at 88 suggests silver is undervalued.",
    reasoning:
      "Industrial demand from green energy transition. Supply deficit widening. Historically, ratio above 80 precedes silver outperformance.",
    entryPrice: 31.2,
    targetPrice: 37.5,
    stopLoss: 29.0,
    tier: "premium",
    timestamp: h(3),
  },
];
