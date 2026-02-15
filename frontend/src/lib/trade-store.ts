import type { Trade, TradeStatus } from "./types";
import { seedTrades } from "./seed-trades";
import { loadJsonSync, writeJson } from "./persist";

const trades = new Map<string, Trade>();

const persisted = loadJsonSync<Trade[]>("trades.json", []);
const initialTrades = persisted.length > 0 ? persisted : seedTrades;
for (const trade of initialTrades) {
  trades.set(trade.id, trade);
}

function persist() {
  writeJson("trades.json", Array.from(trades.values()));
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
  persist();
}

export function updateTrade(id: string, update: Partial<Trade>): void {
  const existing = trades.get(id);
  if (existing) {
    trades.set(id, { ...existing, ...update });
    persist();
  }
}

export function getTradeCount(): number {
  return trades.size;
}
