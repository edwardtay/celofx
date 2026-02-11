import type { VaultDeposit, VaultMetrics, Trade } from "./types";
import { seedDeposits } from "./seed-deposits";

const deposits = new Map<string, VaultDeposit>();

// Initialize with seed data
for (const deposit of seedDeposits) {
  deposits.set(deposit.id, deposit);
}

// Profits earned before current trade history (drove share price from 1.0 → ~1.012)
const SEED_PNL_USD = 1.2;

function getActualPnlUsd(trades: Trade[]): number {
  const confirmed = trades.filter((t) => t.status === "confirmed");
  // Each trade's pnl is the spread %, applied to that trade's notional
  return confirmed.reduce((sum, t) => {
    const notional = parseFloat(t.amountIn);
    return sum + (notional * (t.pnl ?? 0)) / 100;
  }, 0);
}

export function getVaultMetrics(trades: Trade[]): VaultMetrics {
  const active = Array.from(deposits.values()).filter(
    (d) => d.status === "active"
  );
  const totalDeposited = active.reduce((sum, d) => sum + d.amount, 0);
  const totalShares = active.reduce((sum, d) => sum + d.sharesIssued, 0);

  const tradePnl = getActualPnlUsd(trades);
  const pnlAbsolute = SEED_PNL_USD + tradePnl;

  const sharePrice =
    totalShares > 0 ? (totalDeposited + pnlAbsolute) / totalShares : 1.0;
  const tvl = totalShares * sharePrice;

  const depositors = new Set(active.map((d) => d.depositor)).size;

  // APY based on vault lifetime (from oldest deposit)
  const oldestDeposit = active.length > 0
    ? Math.min(...active.map((d) => d.timestamp))
    : Date.now();
  const daysActive = Math.max(
    (Date.now() - oldestDeposit) / (1000 * 60 * 60 * 24),
    0.5
  );
  const returnPct = totalDeposited > 0 ? pnlAbsolute / totalDeposited : 0;
  const apyEstimate = (returnPct / daysActive) * 365 * 100;

  return {
    tvl: parseFloat(tvl.toFixed(2)),
    totalShares: parseFloat(totalShares.toFixed(4)),
    sharePrice: parseFloat(sharePrice.toFixed(6)),
    depositors,
    apyEstimate: parseFloat(Math.min(apyEstimate, 999).toFixed(2)),
    cumulativePnl: parseFloat(pnlAbsolute.toFixed(4)),
  };
}

export function getDeposits(address?: string): VaultDeposit[] {
  let result = Array.from(deposits.values());
  if (address) {
    result = result.filter(
      (d) => d.depositor.toLowerCase() === address.toLowerCase()
    );
  }
  return result.sort((a, b) => b.timestamp - a.timestamp);
}

export function addDeposit(deposit: VaultDeposit): void {
  deposits.set(deposit.id, deposit);
}

export function processWithdrawal(
  depositId: string,
  txHash: string
): VaultDeposit | null {
  const deposit = deposits.get(depositId);
  if (!deposit || deposit.status === "withdrawn") return null;
  const updated = { ...deposit, status: "withdrawn" as const, withdrawTxHash: txHash };
  deposits.set(depositId, updated);
  return updated;
}

export interface PricePoint {
  timestamp: number;
  price: number;
}

export function getSharePriceHistory(trades: Trade[]): PricePoint[] {
  const points: PricePoint[] = [];
  const active = Array.from(deposits.values())
    .filter((d) => d.status === "active")
    .sort((a, b) => a.timestamp - b.timestamp);

  if (active.length === 0) return [{ timestamp: Date.now(), price: 1.0 }];

  // Starting point: vault inception at $1.00
  const inception = active[0].timestamp;
  points.push({ timestamp: inception, price: 1.0 });

  // Build timeline from deposits and trades
  const confirmed = trades
    .filter((t) => t.status === "confirmed")
    .sort((a, b) => a.timestamp - b.timestamp);

  // Simulate share price growth using seed PnL distributed over time
  const totalDuration = Date.now() - inception;
  const steps = 12; // generate 12 data points for a smooth curve
  let runningPnl = 0;
  let tradeIdx = 0;

  for (let i = 1; i <= steps; i++) {
    const t = inception + (totalDuration * i) / steps;

    // Add trade PnL that occurred before this point
    while (tradeIdx < confirmed.length && confirmed[tradeIdx].timestamp <= t) {
      const trade = confirmed[tradeIdx];
      runningPnl +=
        (parseFloat(trade.amountIn) * (trade.pnl ?? 0)) / 100;
      tradeIdx++;
    }

    // Linearly interpolate seed PnL up to this point
    const progress = i / steps;
    const seedPnlAtPoint = SEED_PNL_USD * progress;
    const totalPnlAtPoint = seedPnlAtPoint + runningPnl;

    // Compute shares and deposits at this point
    let sharesAtPoint = 0;
    let depositedAtPoint = 0;
    for (const d of active) {
      if (d.timestamp <= t) {
        sharesAtPoint += d.sharesIssued;
        depositedAtPoint += d.amount;
      }
    }

    const price =
      sharesAtPoint > 0
        ? (depositedAtPoint + totalPnlAtPoint) / sharesAtPoint
        : 1.0;
    points.push({ timestamp: t, price: parseFloat(price.toFixed(6)) });
  }

  return points;
}

export function getUserPosition(
  address: string,
  trades: Trade[]
): {
  totalShares: number;
  currentValue: number;
  totalDeposited: number;
  pnl: number;
  deposits: VaultDeposit[];
} {
  const userDeposits = getDeposits(address).filter(
    (d) => d.status === "active"
  );
  const metrics = getVaultMetrics(trades);
  const totalShares = userDeposits.reduce((sum, d) => sum + d.sharesIssued, 0);
  const currentValue = totalShares * metrics.sharePrice;
  const totalDeposited = userDeposits.reduce((sum, d) => sum + d.amount, 0);
  const pnl = currentValue - totalDeposited;

  return {
    totalShares: parseFloat(totalShares.toFixed(4)),
    currentValue: parseFloat(currentValue.toFixed(4)),
    totalDeposited: parseFloat(totalDeposited.toFixed(4)),
    pnl: parseFloat(pnl.toFixed(4)),
    deposits: userDeposits,
  };
}
