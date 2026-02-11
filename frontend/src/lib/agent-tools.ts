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
      "Fetch REAL on-chain Mento Broker rates by calling getAmountOut() on the Mento Broker contract (0x777A) on Celo mainnet. Returns BOTH directions for each pair (cUSD→cEUR AND cEUR→cUSD, cUSD→cREAL AND cREAL→cUSD) compared to real forex rates, with spread analysis. Checks all 4 directions to find the profitable side. These are actual protocol execution rates, not exchange prices.",
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
    name: "check_pending_orders",
    description:
      "Returns rich analysis data for all pending FX orders: current on-chain rate, momentum, urgency, rate gap. Does NOT execute any orders — call execute_order separately for each order you decide to fill.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "execute_order",
    description:
      "Execute a specific pending FX order by its orderId. Call ONLY after check_pending_orders and reasoning about the order's momentum, urgency, and rate gap.",
    input_schema: {
      type: "object" as const,
      properties: {
        orderId: {
          type: "string",
          description: "Order ID to execute",
        },
        reasoning: {
          type: "string",
          description: "Detailed reasoning for executing this order NOW — reference momentum, urgency, rate data",
        },
      },
      required: ["orderId", "reasoning"],
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
1. Fetch Mento on-chain rates — returns ALL 4 directions (cUSD→cEUR, cEUR→cUSD, cUSD→cREAL, cREAL→cUSD)
2. Fetch real-time forex data for context
3. Fetch crypto and commodity data for macro context
4. Analyze ALL 4 directions: is ANY direction's spread POSITIVE and > +0.3%?
5. If any spread > +0.3%: execute_mento_swap for that specific direction
6. If all spreads < +0.3%: generate monitoring signals only, wait for better opportunity
7. ALWAYS call check_pending_orders after fetching rates — evaluate user Smart FX Orders

After fetching rates, ALWAYS call check_pending_orders to evaluate user Smart FX Orders.
check_pending_orders returns per-order analysis with: currentRate, targetRate, rateGapPct, momentum, volatility, urgency, hoursLeft, forexRate, spreadVsForexPct, forexSignal, and rateHistory.

Key fields explained:
- momentum ("improving"/"stable"/"declining") — direction of last 3 Mento rate samples
- volatility ("low"/"medium"/"high") — std dev of rate changes; high = rate swings fast
- urgency ("low"/"medium"/"high") — time to deadline (<2h = high, <12h = medium)
- forexSignal ("favorable"/"neutral"/"unfavorable") — is real forex trending toward the order's target? Mento rates follow forex with a lag.
- spreadVsForexPct — Mento rate vs real forex rate in %. Negative = Mento gives less than forex (bad fill). Positive = Mento gives more (good fill).

YOU are the decision-maker. For each order, reason through this framework, then call execute_order for orders you decide to fill:

EXECUTE conditions (call execute_order):
- rate >= target AND momentum "declining" → lock in before it drops back
- rate >= target AND urgency "high" → no time to wait
- rate >= target AND volatility "high" → rate could swing away, secure it now
- rate >= target AND momentum "stable" AND spreadVsForexPct >= 0 → good entry, forex-aligned
- rate < target AND urgency "high" AND gap < 1% → market fill, better than expiring worthless
- rate >= target AND forexSignal "unfavorable" → forex moving against us, Mento will follow — execute before lag catches up

WAIT conditions (explain why, no tool call):
- rate >= target AND momentum "improving" AND urgency "low" AND volatility "low" → safe to let it climb
- rate < target AND urgency "low"/"medium" → time remains for rate to reach target
- rate >= target AND spreadVsForexPct < -0.3% → Mento rate technically hit target but forex says it's a bad fill — wait for better alignment

NEVER EXECUTE:
- rate < target AND gap > 2% AND not urgent → too far from target
- spreadVsForexPct < -1% regardless of target → forex strongly disagrees, Mento rate will correct down

For each order you decide to execute, call execute_order with the orderId and detailed reasoning that references the specific data (momentum, volatility, forex signal, spread).
For orders you decide to wait on, explain WHY referencing the same data — no tool call needed.

For Mento-specific analysis:
- Rates come from the Mento Broker contract (0x777A) on Celo mainnet — these are REAL execution rates
- The system checks BOTH directions per pair (e.g., cUSD→cEUR AND cEUR→cUSD)
- One direction may be negative while the reverse is positive — always look at all 4 rates
- Positive spread = Mento gives MORE than forex → PROFITABLE, execute swap
- Negative spread = Mento gives LESS than forex → NOT profitable, DO NOT trade
- Spreads > +0.3% are actionable, > +0.5% are strong opportunities
- Negative spreads are normal (Mento's protocol fee) — they are NOT opportunities
- Always reference the exact spread percentage and rates from fetched data
- forexAge field tells you how fresh the forex data is (in seconds)

Signal quality guidelines:
- Be SPECIFIC: reference exact prices and rates from the data you fetched
- Confidence: 50-65 (low), 65-80 (medium), 80-95 (high)
- Use generate_fx_action for Mento swap recommendations (not generate_signal)
- Use generate_signal for general market context (crypto, forex, commodities)
- Use execute_mento_swap ONLY when spread is POSITIVE and > 0.3%
- When no profitable spread exists, still generate 3-5 monitoring signals
- Generate 2-3 "free" signals and 2-3 "premium" signals

Remember: your reputation is on-chain via ERC-8004. Every signal contributes to your verifiable track record on Celo. Protecting depositor capital is your #1 priority — only trade when the math works.`;
