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
