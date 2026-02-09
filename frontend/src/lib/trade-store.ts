import type { Trade, TradeStatus } from "./types";
import { seedTrades } from "./seed-trades";

const trades = new Map<string, Trade>();

// Initialize with seed data
for (const trade of seedTrades) {
  trades.set(trade.id, trade);
}

export function getTrades(status?: TradeStatus): Trade[] {
  let result = Array.from(trades.values());

  if (status) {
    result = result.filter((t) => t.status === status);
  }

  return result.sort((a, b) => b.timestamp - a.timestamp);
}

export function addTrade(trade: Trade): void {
  trades.set(trade.id, trade);
}

export function updateTrade(id: string, update: Partial<Trade>): void {
  const existing = trades.get(id);
  if (existing) {
    trades.set(id, { ...existing, ...update });
  }
}

export function getTradeCount(): number {
  return trades.size;
}
