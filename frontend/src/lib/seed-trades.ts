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
  {
    id: "trade-real-4",
    pair: "cUSD/cEUR",
    fromToken: "cUSD",
    toToken: "cEUR",
    amountIn: "2",
    amountOut: "1.672",
    rate: 0.836,
    spreadPct: 0.38,
    status: "confirmed",
    approvalTxHash:
      "0x8d9d8140ecfb437c79f7810d88700288b38131ef069d35e4c1959ec300d4fe0c",
    swapTxHash:
      "0xe684cc34728339a37699c1af2af749da3c4ff41d6f049797a6272bacf9fdec66",
    pnl: 0.38,
    timestamp: h(1),
  },
  {
    id: "trade-real-5",
    pair: "cUSD/cREAL",
    fromToken: "cUSD",
    toToken: "cREAL",
    amountIn: "1.5",
    amountOut: "7.773",
    rate: 5.182,
    spreadPct: 0.12,
    status: "confirmed",
    approvalTxHash:
      "0x97b4af5936cb98e854def8e4d16e1c550e9b29fbe7566912bb51b6452720c6d6",
    swapTxHash:
      "0xb66732257bf231ebeb699e2b073d6f078a5e9d0c2b4bb56b53a0f38385e21921",
    pnl: 0.12,
    timestamp: h(1.5),
  },
  {
    id: "trade-real-6",
    pair: "cEUR/cUSD",
    fromToken: "cEUR",
    toToken: "cUSD",
    amountIn: "0.15",
    amountOut: "0.178",
    rate: 1.1867,
    spreadPct: 0.28,
    status: "confirmed",
    approvalTxHash:
      "0x9bd8a34e995347d4e8569cf4b5612789feec281e18f5e299bcd8b459d0e01304",
    swapTxHash:
      "0x708c5fd72f23f3eeea4a834b438f6d505b4f2476786d4ce6ae9459338cfc69eb",
    pnl: 0.28,
    timestamp: h(1.2),
  },
];
