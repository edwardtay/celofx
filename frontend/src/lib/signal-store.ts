import type { Signal, SignalTier, MarketType } from "./types";
import { seedSignals } from "./seed-signals";
import { loadJsonSync, writeJson } from "./persist";

const signals = new Map<string, Signal>();

const persisted = loadJsonSync<Signal[]>("signals.json", []);
const initialSignals = persisted.length > 0 ? persisted : seedSignals;
for (const signal of initialSignals) {
  signals.set(signal.id, signal);
}

function persist() {
  writeJson("signals.json", Array.from(signals.values()));
}

export function getSignals(opts?: {
  tier?: SignalTier;
  market?: MarketType;
}): Signal[] {
  let result = Array.from(signals.values());

  if (opts?.tier) {
    result = result.filter(
      (s) => s.tier === opts.tier || (opts.tier === "premium" && s.tier === "free")
    );
  }

  if (opts?.market) {
    result = result.filter((s) => s.market === opts.market);
  }

  return result.sort((a, b) => b.timestamp - a.timestamp);
}

export function getFreeSignals(market?: MarketType): Signal[] {
  return getSignals({ market }).map((s) => {
    if (s.tier === "premium") {
      // Mento signals: spread data is the signal — show it even for premium
      if (s.market === "mento") {
        return { ...s, stopLoss: undefined };
      }
      // Other premium signals: show reasoning (the hook) but gate prices
      return { ...s, entryPrice: undefined, targetPrice: undefined, stopLoss: undefined };
    }
    return s;
  });
}

export function getPremiumSignals(market?: MarketType): Signal[] {
  return getSignals({ market });
}

export function addSignal(signal: Signal): void {
  signals.set(signal.id, signal);
  persist();
}

export function getSignalCount(): number {
  return signals.size;
}
