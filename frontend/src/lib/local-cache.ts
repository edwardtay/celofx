import type { Signal, Trade } from "./types";

const SIGNALS_KEY = "celofx-signals";
const TRADES_KEY = "celofx-trades";
const LAST_SCAN_KEY = "celofx-last-scan";
const MAX_CACHED = 50;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

// Signals

export function getCachedSignals(): Signal[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(SIGNALS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Signal[];
  } catch {
    return [];
  }
}

export function setCachedSignals(signals: Signal[]): void {
  if (!isBrowser()) return;
  try {
    const sorted = signals
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_CACHED);
    localStorage.setItem(SIGNALS_KEY, JSON.stringify(sorted));
  } catch {
    // localStorage full or unavailable
  }
}

export function mergeSignals(apiSignals: Signal[], cached: Signal[]): Signal[] {
  const byId = new Map<string, Signal>();

  // Cached signals first (lower priority)
  for (const s of cached) {
    byId.set(s.id, s);
  }
  // API signals override cached
  for (const s of apiSignals) {
    byId.set(s.id, s);
  }

  return Array.from(byId.values())
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_CACHED);
}

// Trades

export function getCachedTrades(): Trade[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(TRADES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Trade[];
  } catch {
    return [];
  }
}

export function setCachedTrades(trades: Trade[]): void {
  if (!isBrowser()) return;
  try {
    const sorted = trades
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_CACHED);
    localStorage.setItem(TRADES_KEY, JSON.stringify(sorted));
  } catch {
    // localStorage full or unavailable
  }
}

export function mergeTrades(apiTrades: Trade[], cached: Trade[]): Trade[] {
  const byId = new Map<string, Trade>();

  for (const t of cached) {
    byId.set(t.id, t);
  }
  for (const t of apiTrades) {
    byId.set(t.id, t);
  }

  return Array.from(byId.values())
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_CACHED);
}

// Last scan result (full — tool calls, signals, snapshots)

export interface CachedScanResult {
  toolCalls: { tool: string; summary: string }[];
  signals: { asset: string; direction: string; confidence: number }[];
  snapshots: { market: string; assets: { symbol?: string; price?: number; change24h?: number | null }[] }[];
  iterations: number;
  signalCount: number;
  tradeCount: number | null;
  timestamp: number;
}

const SCAN_RESULT_KEY = "celofx-scan-result";

// Default scan result from a real successful scan — shown to first-time visitors
const DEFAULT_SCAN_RESULT: CachedScanResult = {
  toolCalls: [
    { tool: "fetch_mento_rates", summary: "2 pairs from Broker (on-chain)" },
    { tool: "fetch_forex", summary: "EUR/USD 1.1886, GBP/USD 1.3660, USD/JPY 156.19" },
    { tool: "fetch_crypto", summary: "BTC $69,222, ETH $2,043, SOL $85.43" },
    { tool: "fetch_commodities", summary: "XAU $2,865, WTI $71.2" },
    { tool: "generate_fx_action", summary: "cEUR→cUSD -0.659% spread" },
    { tool: "generate_fx_action", summary: "cREAL→cUSD -0.262% spread" },
    { tool: "generate_signal", summary: "HOLD BTC/USD 68%" },
    { tool: "generate_signal", summary: "LONG Gold 82%" },
    { tool: "generate_signal", summary: "SHORT EUR/USD 74%" },
  ],
  signals: [
    { asset: "cEUR/cUSD", direction: "long", confidence: 78 },
    { asset: "cREAL/cUSD", direction: "long", confidence: 72 },
    { asset: "BTC/USD", direction: "hold", confidence: 68 },
    { asset: "Gold", direction: "long", confidence: 82 },
    { asset: "EUR/USD", direction: "short", confidence: 74 },
  ],
  snapshots: [
    { market: "Mento FX", assets: [{ symbol: "cUSD/cEUR", price: 0.8358, change24h: -0.07 }] },
    { market: "Forex", assets: [{ symbol: "EUR/USD", price: 1.1886, change24h: -0.12 }] },
    { market: "Crypto", assets: [{ symbol: "BTC", price: 69222, change24h: -1.79 }] },
    { market: "Commodities", assets: [{ symbol: "Gold", price: 2865, change24h: 0.85 }] },
  ],
  iterations: 3,
  signalCount: 5,
  tradeCount: 3,
  timestamp: Date.now() - 3600_000, // 1 hour ago
};

export function getLastScanResult(): CachedScanResult | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(SCAN_RESULT_KEY);
    if (!raw) return DEFAULT_SCAN_RESULT;
    return JSON.parse(raw) as CachedScanResult;
  } catch {
    return DEFAULT_SCAN_RESULT;
  }
}

export function setLastScanResult(result: CachedScanResult): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(SCAN_RESULT_KEY, JSON.stringify(result));
  } catch {
    // localStorage full or unavailable
  }
}

// Last scan time

export function getLastScanTime(): number | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(LAST_SCAN_KEY);
    return raw ? parseInt(raw, 10) : null;
  } catch {
    return null;
  }
}

export function setLastScanTime(timestamp: number): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(LAST_SCAN_KEY, String(timestamp));
  } catch {
    // ignore
  }
}
