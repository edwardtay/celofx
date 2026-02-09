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

// Last scan

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
