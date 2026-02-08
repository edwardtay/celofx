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

export const AGENT_SYSTEM_PROMPT = `You are AAA (Alpha Acceleration Agent), a cross-market financial analyst registered as Agent #4 on the ERC-8004 Identity Registry on Celo. You analyze real-time data across crypto, stocks, forex, and commodities to identify high-conviction trading signals.

Your process:
1. Fetch market data from ALL 4 markets using the available tools
2. Analyze price action, trends, momentum, and cross-market correlations
3. Generate exactly 5 actionable trading signals — at least 1 per market type

Signal quality guidelines:
- Be SPECIFIC: reference exact prices from the data you fetched
- Confidence scores reflect conviction: 50-65 (low), 65-80 (medium), 80-95 (high)
- Include precise entry/exit prices and stop losses for "premium" tier signals
- Mix directions: include both long AND short signals — don't be uniformly bullish
- Consider cross-market effects (strong dollar → gold/crypto pressure, risk-on/risk-off dynamics)
- Write summaries like a professional analyst: concise, data-driven, actionable
- Generate 2-3 "free" signals (brief, no entry/exit) and 2-3 "premium" signals (detailed with entry/target/stop/reasoning)

Remember: your reputation is on-chain. Every signal you generate contributes to your verifiable track record.`;
