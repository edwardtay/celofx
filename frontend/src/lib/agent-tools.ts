import type { Tool } from "@anthropic-ai/sdk/resources/messages";

export const agentTools: Tool[] = [
  {
    name: "fetch_crypto",
    description:
      "Fetch current cryptocurrency prices and 24h changes for BTC, ETH, SOL, CELO",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "fetch_stocks",
    description:
      "Fetch current stock prices and 24h changes for AAPL, NVDA, TSLA, MSFT",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "fetch_forex",
    description:
      "Fetch current forex rates for EUR/USD, GBP/USD, USD/JPY, USD/CHF",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "fetch_commodities",
    description:
      "Fetch current commodity prices for Gold, Oil, Silver, Natural Gas",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "generate_signal",
    description:
      "Generate a trading signal based on market analysis. Call this after analyzing market data.",
    input_schema: {
      type: "object" as const,
      properties: {
        market: {
          type: "string",
          enum: ["crypto", "stocks", "forex", "commodities"],
          description: "Market type",
        },
        asset: {
          type: "string",
          description: "Asset symbol (e.g. BTC/USD, NVDA, EUR/USD, Gold)",
        },
        direction: {
          type: "string",
          enum: ["long", "short", "hold"],
          description: "Trade direction",
        },
        confidence: {
          type: "number",
          description: "Confidence level 0-100",
        },
        summary: {
          type: "string",
          description: "Brief signal summary (1-2 sentences)",
        },
        reasoning: {
          type: "string",
          description: "Detailed reasoning for the signal",
        },
        entryPrice: {
          type: "number",
          description: "Suggested entry price",
        },
        targetPrice: {
          type: "number",
          description: "Target price",
        },
        stopLoss: {
          type: "number",
          description: "Stop loss price",
        },
        tier: {
          type: "string",
          enum: ["free", "premium"],
          description: "Signal tier — free for basic, premium for detailed",
        },
      },
      required: [
        "market",
        "asset",
        "direction",
        "confidence",
        "summary",
        "tier",
      ],
    },
  },
];

export const AGENT_SYSTEM_PROMPT = `You are $AAA (Alpha Acceleration Agent), a cross-market financial analyst AI agent. You analyze data across crypto, stocks, forex, and commodities to identify high-conviction trading signals.

Your process:
1. Fetch market data from all 4 markets using the available tools
2. Analyze price action, trends, and cross-market correlations
3. Generate 3-5 actionable trading signals with confidence scores

Guidelines:
- Be specific with asset names and prices
- Confidence scores should reflect conviction: 50-65 (low), 65-80 (medium), 80-95 (high)
- Include entry/exit prices for premium signals
- Mix long, short, and hold signals — don't be uniformly bullish or bearish
- Consider cross-market effects (e.g., strong dollar impact on gold and crypto)
- Generate at least one signal per market type
- Mark detailed signals with entry/target/stop as "premium", brief ones as "free"`;
