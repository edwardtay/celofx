import type { Trade } from "./types";

// All 9 trades are REAL on-chain Mento Broker swaps executed by agent wallet
// 0x6652AcDc623b7CCd52E115161d84b949bAf3a303 on Celo mainnet.
// Every swapTxHash and approvalTxHash resolves on Celoscan.

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
    timestamp: 1770661383000, // 2026-02-10 02:23 UTC
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
    timestamp: 1770661972000, // 2026-02-10 02:32 UTC
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
    timestamp: 1770661992000, // 2026-02-10 02:33 UTC
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
    timestamp: 1770753592000, // 2026-02-11 03:59 UTC
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
    timestamp: 1770753604000, // 2026-02-11 04:00 UTC
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
    timestamp: 1770753618000, // 2026-02-11 04:00 UTC
  },
  {
    id: "trade-real-7",
    pair: "cUSD/cEUR",
    fromToken: "cUSD",
    toToken: "cEUR",
    amountIn: "2",
    amountOut: "1.673",
    rate: 0.8365,
    spreadPct: 0.35,
    status: "confirmed",
    approvalTxHash:
      "0x4cfa7c70e9f06f9a024181210774093d860a016856cba9020f78162a97a6ad11",
    swapTxHash:
      "0xe998c8003138a096562c00a71e0e1767e768a2acecb776d0ee10eaabfd05ff76",
    pnl: 0.35,
    timestamp: 1770757336000, // 2026-02-11 05:02 UTC
  },
  {
    id: "trade-real-8",
    pair: "cUSD/cREAL",
    fromToken: "cUSD",
    toToken: "cREAL",
    amountIn: "1.5",
    amountOut: "7.774",
    rate: 5.1826,
    spreadPct: 0.1,
    status: "confirmed",
    approvalTxHash:
      "0x469bf235613913be428be39c04a874f631cd3860adcb1f8fe393e8d8e21a0e0a",
    swapTxHash:
      "0x3830c2b39a6207b29de132731e64fccfedd098b8fe2be4bd3d220b176ba17139",
    pnl: 0.1,
    timestamp: 1770757349000, // 2026-02-11 05:02 UTC
  },
  {
    id: "trade-real-9",
    pair: "cEUR/cUSD",
    fromToken: "cEUR",
    toToken: "cUSD",
    amountIn: "0.15",
    amountOut: "0.178",
    rate: 1.1835,
    spreadPct: 0.25,
    status: "confirmed",
    approvalTxHash:
      "0x5dd312c8fd66831b19f06c0ccdd8dae907dcf3b367c680150acae068727f3cd8",
    swapTxHash:
      "0x3126ec624216415b594d71535e4d83a1b2c89412c6365ad73d7381b9bd07ed96",
    pnl: 0.25,
    timestamp: 1770757366000, // 2026-02-11 05:02 UTC
  },
];
