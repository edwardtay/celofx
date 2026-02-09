import type { Signal, SignalTier, MarketType } from "./types";
import { seedSignals } from "./seed-signals";

const signals = new Map<string, Signal>();

// Initialize with seed data
for (const signal of seedSignals) {
  signals.set(signal.id, signal);
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
      // Premium signals: show reasoning (the hook) but gate prices
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
}

export function getSignalCount(): number {
  return signals.size;
}
