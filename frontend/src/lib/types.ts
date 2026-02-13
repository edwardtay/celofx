export type MarketType = "crypto" | "forex" | "commodities" | "mento";

export type SignalDirection = "long" | "short" | "hold";

export type SignalTier = "free" | "premium";

export interface Signal {
  id: string;
  market: MarketType;
  asset: string;
  direction: SignalDirection;
  confidence: number;
  summary: string;
  reasoning?: string;
  entryPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  tier: SignalTier;
  timestamp: number;
}

export interface MarketData {
  market: MarketType;
  assets: AssetPrice[];
}

export interface AssetPrice {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
}

export interface AgentProfile {
  agentId: number;
  name: string;
  description: string;
  owner: string;
  wallet: string;
  uri: string;
  reputation: {
    totalScore: number;
    feedbackCount: number;
  };
}

export interface FeedbackEntry {
  reviewer: string;
  score: number;
  comment: string;
  timestamp: number;
}

export type DepositStatus = "active" | "withdrawn";

export interface VaultDeposit {
  id: string;
  depositor: string;
  amount: number;
  sharesIssued: number;
  sharePriceAtEntry: number;
  txHash: string;
  status: DepositStatus;
  withdrawTxHash?: string;
  timestamp: number;
}

export interface VaultMetrics {
  tvl: number;
  totalShares: number;
  sharePrice: number;
  depositors: number;
  apyEstimate: number;
  cumulativePnl: number;
}

export type TradeStatus = "pending" | "confirmed" | "failed";

export interface Trade {
  id: string;
  pair: string;
  fromToken: string;
  toToken: string;
  amountIn: string;
  amountOut: string;
  rate: number;
  spreadPct: number;
  status: TradeStatus;
  approvalTxHash?: string;
  swapTxHash?: string;
  error?: string;
  pnl?: number;
  timestamp: number;
}

export type OrderStatus = "pending" | "executed" | "expired" | "cancelled";

export type AlertConditionType = "rate_reaches" | "pct_change" | "rate_crosses_above" | "rate_crosses_below";

export interface FxOrder {
  id: string;
  creator: string;
  fromToken: string;
  toToken: string;
  amountIn: string;
  targetRate: number;
  deadline: number;
  status: OrderStatus;
  createdAt: number;
  executedAt?: number;
  executedRate?: number;
  executedTxHash?: string;
  agentReasoning?: string;
  lastCheckedAt?: number;
  checksCount?: number;
  rateHistory?: { rate: number; timestamp: number }[];
  // Flexible alert conditions
  conditionType?: AlertConditionType;
  pctChangeThreshold?: number; // e.g. 5 for 5%
  pctChangeTimeframe?: "1h" | "4h" | "24h";
  referenceRate?: number; // snapshot of rate at order creation (for pct_change, crosses)
}

export interface PortfolioAllocation {
  token: string;
  targetPct: number;
}

export interface PortfolioHoldingView {
  token: string;
  balance: number;
  valueCusd: number;
  actualPct: number;
  targetPct: number;
  driftPct: number;
}

export interface PortfolioCompositionView {
  holdings: PortfolioHoldingView[];
  totalValueCusd: number;
  maxDriftPct: number;
  needsRebalance: boolean;
  timestamp: number;
}
