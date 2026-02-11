import type { FxOrder } from "./types";

const now = Date.now();
const h = (hours: number) => now - hours * 60 * 60 * 1000;

export const seedOrders: FxOrder[] = [
  {
    id: "order-seed-1",
    creator: "0x6652AcDc623b7CCd52E115161d84b949bAf3a303",
    fromToken: "cUSD",
    toToken: "cEUR",
    amountIn: "50",
    targetRate: 0.845,
    deadline: now + 48 * 60 * 60 * 1000,
    status: "pending",
    createdAt: h(6),
    checksCount: 4,
    lastCheckedAt: h(0.5),
    rateHistory: [
      { rate: 0.838, timestamp: h(6) },
      { rate: 0.839, timestamp: h(4) },
      { rate: 0.840, timestamp: h(2) },
      { rate: 0.841, timestamp: h(0.5) },
    ],
  },
  {
    id: "order-seed-2",
    creator: "0x6652AcDc623b7CCd52E115161d84b949bAf3a303",
    fromToken: "cUSD",
    toToken: "cREAL",
    amountIn: "25",
    targetRate: 5.25,
    deadline: now + 24 * 60 * 60 * 1000,
    status: "pending",
    createdAt: h(3),
    checksCount: 2,
    lastCheckedAt: h(1),
    rateHistory: [
      { rate: 5.18, timestamp: h(3) },
      { rate: 5.20, timestamp: h(1) },
    ],
  },
  {
    id: "order-seed-3",
    creator: "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B",
    fromToken: "cUSD",
    toToken: "cEUR",
    amountIn: "30",
    targetRate: 0.84,
    deadline: h(1),
    status: "executed",
    createdAt: h(12),
    executedAt: h(2),
    executedRate: 0.841,
    executedTxHash: "0xe998c8003138a096562c00a71e0e1767e768a2acecb776d0ee10eaabfd05ff76",
    agentReasoning:
      "Mento cUSD/cEUR rate hit 0.841, exceeding target of 0.840. EUR/USD forex trending down (1.186 → 1.183), widening the Mento spread. Executed immediately as rate may not hold — deadline was 1h away.",
    checksCount: 8,
    lastCheckedAt: h(2),
    rateHistory: [
      { rate: 0.834, timestamp: h(12) },
      { rate: 0.835, timestamp: h(10) },
      { rate: 0.836, timestamp: h(8) },
      { rate: 0.837, timestamp: h(7) },
      { rate: 0.838, timestamp: h(5) },
      { rate: 0.839, timestamp: h(4) },
      { rate: 0.840, timestamp: h(3) },
      { rate: 0.841, timestamp: h(2) },
    ],
  },
];
