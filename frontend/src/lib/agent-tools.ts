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
    name: "fetch_forex",
    description:
      "Fetch current forex rates for EUR/USD, GBP/USD, USD/JPY, USD/CHF — these are real-world FX rates to compare against Mento on-chain rates",
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
    name: "fetch_mento_rates",
    description:
      "Fetch REAL on-chain Mento Broker rates by calling getAmountOut() on the Mento Broker contract (0x777A) on Celo mainnet. Returns cUSD/cEUR and cUSD/cREAL rates compared to real forex rates, with spread analysis. These are actual protocol execution rates, not exchange prices.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "generate_signal",
    description:
      "Generate a trading signal based on market analysis. Use for general market context signals (crypto, forex, commodities).",
    input_schema: {
      type: "object" as const,
      properties: {
        market: {
          type: "string",
          enum: ["crypto", "forex", "commodities", "mento"],
          description: "Market type",
        },
        asset: {
          type: "string",
          description: "Asset symbol (e.g. BTC/USD, EUR/USD, cUSD/cEUR, Gold)",
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
  {
    name: "generate_fx_action",
    description:
      "Generate a specific Mento stablecoin swap recommendation. Use this when you identify an FX opportunity on Mento — e.g., Mento rate for cUSD→cEUR is better than real forex rate.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: ["swap"],
          description: "Action type",
        },
        fromToken: {
          type: "string",
          enum: ["cUSD", "cEUR", "cREAL", "CELO"],
          description: "Token to swap from",
        },
        toToken: {
          type: "string",
          enum: ["cUSD", "cEUR", "cREAL", "CELO"],
          description: "Token to swap to",
        },
        confidence: {
          type: "number",
          description: "Confidence level 0-100",
        },
        reasoning: {
          type: "string",
          description: "Why this swap is recommended — reference specific rate data",
        },
        mentoRate: {
          type: "number",
          description: "Current Mento exchange rate for this pair",
        },
        forexRate: {
          type: "number",
          description: "Real-world forex rate for comparison",
        },
        spreadPct: {
          type: "number",
          description: "Spread between Mento and forex rate in %",
        },
        tier: {
          type: "string",
          enum: ["free", "premium"],
          description: "Signal tier",
        },
      },
      required: [
        "action",
        "fromToken",
        "toToken",
        "confidence",
        "reasoning",
        "tier",
      ],
    },
  },
  {
    name: "execute_mento_swap",
    description:
      "Build a real Mento swap transaction on Celo mainnet. Calls the Mento Broker contract to get a fresh on-chain quote and returns the transaction data (approval + swap) ready for wallet execution. Use this when you have high confidence in a spread opportunity.",
    input_schema: {
      type: "object" as const,
      properties: {
        fromToken: {
          type: "string",
          enum: ["cUSD", "cEUR", "cREAL"],
          description: "Token to swap from",
        },
        toToken: {
          type: "string",
          enum: ["cUSD", "cEUR", "cREAL"],
          description: "Token to swap to",
        },
        amount: {
          type: "string",
          description: "Amount to swap in human-readable units (e.g. '1' for 1 cUSD)",
        },
        reasoning: {
          type: "string",
          description: "Why this swap should be executed now",
        },
      },
      required: ["fromToken", "toToken", "amount", "reasoning"],
    },
  },
];

export const AGENT_SYSTEM_PROMPT = `You are CeloFX, an autonomous FX Arbitrage Agent (ERC-8004 ID #4) on the Celo Identity Registry. You specialize in analyzing forex markets and executing stablecoin swaps via the Mento Protocol on Celo.

Your core capability: Compare real-world forex rates with Mento on-chain stablecoin rates (cUSD, cEUR, cREAL) to find profitable swap opportunities. When Mento's rate diverges from the real forex rate, that's your signal.

Your process:
1. Fetch Mento on-chain rates (calls getAmountOut() on Mento Broker contract on Celo mainnet)
2. Fetch real-time forex data for context
3. Fetch crypto and commodity data for macro context
4. Generate 3-5 signals — at least 1-2 should be Mento FX actions
5. If a spread is large enough (>0.3%), use execute_mento_swap to build a real swap transaction

For Mento-specific analysis:
- Rates come from the Mento Broker contract (0x777A) on Celo mainnet — these are REAL execution rates
- Positive spread = Mento gives MORE than real forex rate → swap INTO that stablecoin
- Negative spread = Mento gives LESS → swap OUT (reverse direction)
- Spreads > 0.2% are notable, > 0.5% are strong opportunities
- Always reference the exact spread percentage and rates from fetched data

Signal quality guidelines:
- Be SPECIFIC: reference exact prices and rates from the data you fetched
- Confidence: 50-65 (low), 65-80 (medium), 80-95 (high)
- Use generate_fx_action for Mento swap recommendations (not generate_signal)
- Use generate_signal for general market context (crypto, forex, commodities)
- Use execute_mento_swap when you have high confidence (>75%) and a spread > 0.3%
- Mix: 2-3 Mento FX actions + 1-2 general market signals
- Generate 2-3 "free" signals and 2-3 "premium" signals

Remember: your reputation is on-chain via ERC-8004. Every signal contributes to your verifiable track record on Celo.`;
