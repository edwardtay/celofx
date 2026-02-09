import type { Trade } from "./types";

const now = Date.now();
const h = (hours: number) => now - hours * 60 * 60 * 1000;

export const seedTrades: Trade[] = [
  {
    id: "trade-real-1",
    pair: "cUSD/cEUR",
    fromToken: "cUSD",
    toToken: "cEUR",
    amountIn: "2",
    amountOut: "1.671",
    rate: 0.8356,
    spreadPct: 0.42,
    status: "confirmed",
    approvalTxHash:
      "0xe01f8c9939da0ec77bdbbc00515ca0619f21a628735c57f46bcb03fa286bcf40",
    swapTxHash:
      "0x9978b5be04f1641ef99c98caa3115ca4654a77fbb7e4bdffef87ae045fb9d808",
    pnl: 0.42,
    timestamp: h(2),
  },
  {
    id: "trade-real-2",
    pair: "cUSD/cREAL",
    fromToken: "cUSD",
    toToken: "cREAL",
    amountIn: "1.5",
    amountOut: "7.766",
    rate: 5.1775,
    spreadPct: 0.15,
    status: "confirmed",
    approvalTxHash:
      "0x555c46cf6c41996e933c0e3d4176ff907189b05e8e689eb997782e86e45a3452",
    swapTxHash:
      "0xf0672921205c035c95a3c52d3e83875f282b52118001bbbe84e8307d436dc7a3",
    pnl: 0.15,
    timestamp: h(4),
  },
  {
    id: "trade-real-3",
    pair: "cEUR/cUSD",
    fromToken: "cEUR",
    toToken: "cUSD",
    amountIn: "1.5",
    amountOut: "1.778",
    rate: 1.1853,
    spreadPct: 0.31,
    status: "confirmed",
    approvalTxHash:
      "0x9df04991c96c3cb3153708aff02b2a8d07763b7034e53507de7ae727a6490bc8",
    swapTxHash:
      "0x49e855cd09b86eec045fa9fceda35b7cc23e1d3cb11dc223525dbf1c0c26ff18",
    pnl: 0.31,
    timestamp: h(6),
  },
];
