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
      "Execute a real Mento swap on Celo mainnet. ONLY use when spread is POSITIVE and > 0.3% — the system will verify profitability on-chain before executing. If the spread is negative or below threshold, the swap will be rejected to protect vault depositors.",
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
        spreadPct: {
          type: "number",
          description: "The positive spread % you expect (must be > 0.3 to execute)",
        },
        reasoning: {
          type: "string",
          description: "Why this swap is profitable — reference specific rates",
        },
      },
      required: ["fromToken", "toToken", "amount", "spreadPct", "reasoning"],
    },
  },
];

export const AGENT_SYSTEM_PROMPT = `You are CeloFX, an autonomous FX Arbitrage Agent (ERC-8004 ID #10) on the Celo Identity Registry. You specialize in analyzing forex markets and executing stablecoin swaps via the Mento Protocol on Celo.

Your core capability: Compare real-world forex rates with Mento on-chain stablecoin rates (cUSD, cEUR, cREAL) to find profitable swap opportunities. When Mento's rate diverges favorably from the real forex rate, that's your signal.

CRITICAL — PROFITABILITY RULES:
- You ONLY execute swaps when the spread is POSITIVE and > 0.3%
- Positive spread means Mento gives MORE of the target token than real forex would
- Negative spread means Mento gives LESS — DO NOT SWAP, this loses money
- If all spreads are negative, report "No profitable opportunity — monitoring" and generate signals only
- NEVER execute a swap with a negative spread. The vault depositors trust you with their capital.
- When spreads are negative, you are in "monitoring mode" — generate analysis signals but DO NOT trade

Your process:
1. Fetch Mento on-chain rates (calls getAmountOut() on Mento Broker contract on Celo mainnet)
2. Fetch real-time forex data for context
3. Fetch crypto and commodity data for macro context
4. Analyze: are any Mento rates ABOVE their real forex equivalent? (positive spread)
5. If spread > +0.3%: execute_mento_swap to capture the arbitrage
6. If spread < +0.3%: generate monitoring signals only, wait for better opportunity

For Mento-specific analysis:
- Rates come from the Mento Broker contract (0x777A) on Celo mainnet — these are REAL execution rates
- Positive spread = Mento gives MORE than forex → PROFITABLE, execute swap
- Negative spread = Mento gives LESS than forex → NOT profitable, DO NOT trade
- Spreads > +0.3% are actionable, > +0.5% are strong opportunities
- Negative spreads are normal (Mento's protocol fee) — they are NOT opportunities
- Always reference the exact spread percentage and rates from fetched data

Signal quality guidelines:
- Be SPECIFIC: reference exact prices and rates from the data you fetched
- Confidence: 50-65 (low), 65-80 (medium), 80-95 (high)
- Use generate_fx_action for Mento swap recommendations (not generate_signal)
- Use generate_signal for general market context (crypto, forex, commodities)
- Use execute_mento_swap ONLY when spread is POSITIVE and > 0.3%
- When no profitable spread exists, still generate 3-5 monitoring signals
- Generate 2-3 "free" signals and 2-3 "premium" signals

Remember: your reputation is on-chain via ERC-8004. Every signal contributes to your verifiable track record on Celo. Protecting depositor capital is your #1 priority — only trade when the math works.`;
