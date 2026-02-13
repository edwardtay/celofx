export interface RebalanceRecord {
  id: string;
  timestamp: number;
  trades: Array<{
    fromToken: string;
    toToken: string;
    amountIn: string;
    amountOut: string;
    txHash?: string;
  }>;
  driftBefore: number;
  driftAfter: number;
  totalCostUsd: number; // estimated gas cost in USD
  trigger: string; // e.g. "drift > 5%", "scheduled"
}

const rebalances = new Map<string, RebalanceRecord>();

export function addRebalance(record: RebalanceRecord): void {
  rebalances.set(record.id, record);
}

export function getRebalances(limit?: number): RebalanceRecord[] {
  const all = Array.from(rebalances.values()).sort(
    (a, b) => b.timestamp - a.timestamp
  );
  return limit ? all.slice(0, limit) : all;
}

export function getCumulativeRebalanceCost(): {
  totalCostUsd: number;
  count: number;
  avgCostUsd: number;
  avgDriftReduction: number;
} {
  const all = Array.from(rebalances.values());
  if (all.length === 0) {
    return { totalCostUsd: 0, count: 0, avgCostUsd: 0, avgDriftReduction: 0 };
  }

  const totalCostUsd = all.reduce((sum, r) => sum + r.totalCostUsd, 0);
  const totalDriftReduction = all.reduce(
    (sum, r) => sum + (r.driftBefore - r.driftAfter),
    0
  );

  return {
    totalCostUsd,
    count: all.length,
    avgCostUsd: totalCostUsd / all.length,
    avgDriftReduction: totalDriftReduction / all.length,
  };
}
