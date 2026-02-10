import type { Signal } from "./types";

const now = Date.now();
const h = (hours: number) => now - hours * 60 * 60 * 1000;

export const seedSignals: Signal[] = [
  // Mento FX actions — rates aligned with current Mento Broker on-chain data
  {
    id: "seed-1",
    market: "mento",
    asset: "cUSD/cEUR",
    direction: "short",
    confidence: 74,
    summary:
      "Mento cUSD→cEUR rate -0.69% below real forex. Wait for spread to narrow before swapping.",
    reasoning:
      "Mento Broker getAmountOut(1e18 cUSD) returned 0.8355e18 cEUR. Real EUR/USD at 1.1886 → inverted = 0.8413. Spread: (0.8355-0.8413)/0.8413 = -0.69%. Oracle last synced 47 min ago. ECB held rates at 2.65% — no policy shock expected. Spread likely narrows toward 0% within 2-4h as SortedOracles refresh. Wait for positive flip before executing.",
    entryPrice: 0.8355,
    targetPrice: 0.8413,
    tier: "free",
    timestamp: h(1),
  },
  {
    id: "seed-2",
    market: "mento",
    asset: "cUSD/cREAL",
    direction: "hold",
    confidence: 68,
    summary:
      "cUSD→cREAL spread near neutral at -0.25%. No actionable opportunity — continue monitoring.",
    reasoning:
      "Mento Broker getAmountOut(1e18 cUSD) returned 5.18e18 cREAL. CoinGecko USD/BRL spot at 5.19. Spread: (5.18-5.19)/5.19 = -0.19%. Below 0.3% auto-execution threshold. Selic at 13.25% creates carry demand for cREAL but on-chain liquidity is thin. Gas cost at 0.001 CELO makes sub-0.3% spreads unprofitable. Monitoring for BCB rate decision impact.",
    entryPrice: 5.18,
    targetPrice: 5.19,
    tier: "free",
    timestamp: h(2),
  },
  // Crypto
  {
    id: "seed-3",
    market: "crypto",
    asset: "BTC/USD",
    direction: "long",
    confidence: 78,
    summary:
      "Bitcoin holding above key support. Institutional accumulation continues — risk-on backdrop supports stablecoin demand.",
    reasoning:
      "ETF inflows steady. Exchange reserves declining. Strong macro backdrop increases demand for on-chain FX via Mento stablecoins. BTC strength correlates with higher Mento trading volume.",
    entryPrice: 69000,
    targetPrice: 78000,
    stopLoss: 62000,
    tier: "free",
    timestamp: h(4),
  },
  {
    id: "seed-4",
    market: "crypto",
    asset: "CELO/USD",
    direction: "long",
    confidence: 71,
    summary:
      "Celo L2 migration driving developer activity. Mento FX volume growth supports CELO token demand.",
    reasoning:
      "Mobile-first thesis gaining traction in emerging markets. cUSD supply expanding. Agent ecosystem (ERC-8004) adds utility layer. Mento daily volume trending up — positive for CELO.",
    entryPrice: 0.082,
    targetPrice: 0.12,
    stopLoss: 0.065,
    tier: "premium",
    timestamp: h(5),
  },
  // Forex
  {
    id: "seed-5",
    market: "forex",
    asset: "EUR/USD",
    direction: "short",
    confidence: 72,
    summary:
      "Dollar strengthening on hawkish Fed. EUR weakness may widen Mento cUSD/cEUR spread — creating future opportunity.",
    reasoning:
      "US-EU yield spread at 200bps. ECB cutting faster than Fed. EUR weakness should push Mento cUSD/cEUR spread from negative to positive as oracle updates lag — creating a window to swap.",
    entryPrice: 1.189,
    targetPrice: 1.155,
    stopLoss: 1.205,
    tier: "free",
    timestamp: h(6),
  },
  {
    id: "seed-6",
    market: "forex",
    asset: "USD/BRL",
    direction: "long",
    confidence: 65,
    summary:
      "Brazilian Real under pressure from fiscal concerns. Watch for Mento cREAL spread to turn positive.",
    reasoning:
      "Brazil fiscal deficit widening. But high Selic rate makes cREAL attractive for yield-seeking capital. If BRL weakens further, Mento oracle lag may create positive spread on cUSD→cREAL.",
    entryPrice: 5.19,
    targetPrice: 5.45,
    stopLoss: 5.02,
    tier: "premium",
    timestamp: h(7),
  },
  // Commodity
  {
    id: "seed-7",
    market: "commodities",
    asset: "Gold (XAU)",
    direction: "long",
    confidence: 82,
    summary:
      "Gold at all-time highs. De-dollarization trend drives stablecoin adoption — bullish for Mento FX volume.",
    reasoning:
      "Central bank buying accelerating. Real rates declining. Gold strength = risk-off environment where stablecoin demand increases. More Mento volume = tighter spreads and better execution.",
    entryPrice: 5051,
    targetPrice: 5400,
    stopLoss: 4800,
    tier: "free",
    timestamp: h(8),
  },
  // Cross-pair Mento FX
  {
    id: "seed-8",
    market: "mento",
    asset: "cEUR/cREAL",
    direction: "hold",
    confidence: 62,
    summary:
      "Cross-pair cEUR→cREAL via Mento router. Current spread near neutral — waiting for divergence.",
    reasoning:
      "Implied cross-rate via Mento: cEUR→cUSD (1.1853) then cUSD→cREAL (5.18) gives EUR/BRL = 6.20. Real EUR/BRL at 6.17. Delta: +0.49%. But this is a 2-leg route requiring two Broker swaps (2x gas, 2x approval). Net spread after gas: ~0.3%. Below threshold for auto-execution on cross-pairs. Need >1% for multi-hop profitability.",
    entryPrice: 6.20,
    targetPrice: 6.17,
    tier: "premium",
    timestamp: h(9),
  },
  // Low-confidence signal for realism
  {
    id: "seed-9",
    market: "forex",
    asset: "GBP/USD",
    direction: "hold",
    confidence: 48,
    summary:
      "GBP/USD directionless — no Mento pair exists. Low relevance to stablecoin FX strategy.",
    reasoning:
      "No cGBP on Mento, so no on-chain arbitrage angle. Cable trading at 1.2410 in tight 30-pip range. BoE rate path unclear. Signal retained for cross-market context only — no actionable trade for the agent.",
    entryPrice: 1.241,
    targetPrice: 1.255,
    stopLoss: 1.228,
    tier: "free",
    timestamp: h(10),
  },
];
