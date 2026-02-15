import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/format";

const SPEC = {
  openapi: "3.0.3",
  info: {
    title: "CeloFX Agent API",
    description:
      "Autonomous FX Arbitrage Agent on Celo. Monitors Mento Broker + Uniswap V3 rates vs real forex, executes profitable stablecoin swaps, manages hedged portfolios, and processes cross-border remittances. ERC-8004 registered (Agent #10).",
    version: "1.0.0",
    contact: { name: "CeloFX", url: "https://github.com/celofx" },
    license: { name: "MIT" },
  },
  servers: [
    { url: "PLACEHOLDER_BASE_URL", description: "Production (Celo Mainnet)" },
    { url: "http://localhost:3000", description: "Local development" },
  ],
  tags: [
    { name: "Market Data", description: "Real-time rates from Mento, Uniswap, forex, crypto" },
    { name: "Agent", description: "Agent status, policy, decisions, track record" },
    { name: "Trades", description: "Executed on-chain swaps" },
    { name: "Signals", description: "AI-generated trading signals" },
    { name: "Orders", description: "Smart FX conditional orders" },
    { name: "Swap", description: "Quote and execute token swaps" },
    { name: "Vault", description: "Hedged portfolio vault" },
    { name: "Remittance", description: "Cross-border transfers and recurring schedules" },
    { name: "Security", description: "TEE attestation, SelfClaw verification" },
    { name: "Protocols", description: "MCP, A2A, x402 integration endpoints" },
  ],
  paths: {
    "/api/health": {
      get: {
        tags: ["Agent"],
        summary: "Health check",
        description: "Returns agent status, service health, and basic stats.",
        responses: {
          "200": {
            description: "Agent is healthy",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthResponse" },
              },
            },
          },
        },
      },
    },
    "/api/market-data/mento": {
      get: {
        tags: ["Market Data"],
        summary: "Mento on-chain rates",
        description:
          "Live rates from Mento Broker contract (0x777A) on Celo mainnet. Returns BOTH directions per pair (cUSD→cEUR AND cEUR→cUSD) compared with real forex rates. Includes spread analysis and direction recommendation.",
        responses: {
          "200": {
            description: "Array of Mento rate comparisons",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/MentoRate" } },
              },
            },
          },
        },
      },
    },
    "/api/market-data/cross-venue": {
      get: {
        tags: ["Market Data"],
        summary: "Cross-venue rate comparison",
        description:
          "Compare Mento Broker vs Uniswap V3 vs real forex rates. Returns per-pair venue spread, best venue, and arbitrage opportunities.",
        responses: {
          "200": {
            description: "Array of cross-venue comparisons",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/CrossVenueRate" } },
              },
            },
          },
        },
      },
    },
    "/api/market-data/forex": {
      get: {
        tags: ["Market Data"],
        summary: "Real-world forex rates",
        description: "EUR/USD, GBP/USD, USD/JPY, USD/CHF from Frankfurter API.",
        responses: {
          "200": {
            description: "Array of forex rate objects",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/AssetPrice" } } } },
          },
        },
      },
    },
    "/api/market-data/crypto": {
      get: {
        tags: ["Market Data"],
        summary: "Cryptocurrency prices",
        description: "BTC, ETH, SOL, CELO prices and 24h changes from CoinGecko.",
        responses: {
          "200": {
            description: "Array of crypto price objects",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/AssetPrice" } } } },
          },
        },
      },
    },
    "/api/market-data/commodities": {
      get: {
        tags: ["Market Data"],
        summary: "Commodity prices",
        description: "Gold, Oil, Silver, Natural Gas prices.",
        responses: {
          "200": {
            description: "Array of commodity price objects",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/AssetPrice" } } } },
          },
        },
      },
    },
    "/api/signals": {
      get: {
        tags: ["Signals"],
        summary: "Trading signals",
        description: "AI-generated trading signals. Filter by market type.",
        parameters: [
          {
            name: "market",
            in: "query",
            schema: { type: "string", enum: ["crypto", "forex", "commodities", "mento"] },
            description: "Filter by market type",
          },
        ],
        responses: {
          "200": {
            description: "Array of signals",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Signal" } } } },
          },
        },
      },
    },
    "/api/trades": {
      get: {
        tags: ["Trades"],
        summary: "Trade history",
        description: "All executed on-chain swaps with tx hashes and P&L.",
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["pending", "confirmed", "failed"] },
            description: "Filter by trade status",
          },
        ],
        responses: {
          "200": {
            description: "Array of trades",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Trade" } } } },
          },
        },
      },
    },
    "/api/orders": {
      get: {
        tags: ["Orders"],
        summary: "List FX orders",
        description: "Smart FX conditional orders with 4 condition types.",
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["pending", "executed", "expired", "cancelled"] } },
          { name: "creator", in: "query", schema: { type: "string" }, description: "Filter by wallet address" },
        ],
        responses: {
          "200": {
            description: "Orders list",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    orders: { type: "array", items: { $ref: "#/components/schemas/FxOrder" } },
                    count: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ["Orders"],
        summary: "Create or cancel an order",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  action: { type: "string", enum: ["create", "cancel"] },
                  creator: { type: "string", description: "Wallet address" },
                  fromToken: { type: "string", enum: ["cUSD", "cEUR", "cREAL", "USDC", "USDT"] },
                  toToken: { type: "string", enum: ["cUSD", "cEUR", "cREAL", "USDC", "USDT"] },
                  amountIn: { type: "string" },
                  targetRate: { type: "number" },
                  deadlineHours: { type: "number", default: 24 },
                  conditionType: { type: "string", enum: ["rate_reaches", "pct_change", "rate_crosses_above", "rate_crosses_below"] },
                  pctChangeThreshold: { type: "number", description: "For pct_change: trigger threshold %" },
                  pctChangeTimeframe: { type: "string", enum: ["1h", "4h", "24h"] },
                },
                required: ["action", "creator", "fromToken", "toToken", "amountIn"],
              },
            },
          },
        },
        responses: {
          "201": { description: "Order created" },
          "200": { description: "Order cancelled" },
          "400": {
            description: "Validation error",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } },
          },
        },
      },
    },
    "/api/swap/quote": {
      get: {
        tags: ["Swap"],
        summary: "Get swap quote",
        description: "Quote from Mento or Uniswap V3. Auto-selects best venue.",
        parameters: [
          { name: "from", in: "query", required: true, schema: { type: "string" }, description: "Token to swap from" },
          { name: "to", in: "query", required: true, schema: { type: "string" }, description: "Token to swap to" },
          { name: "amount", in: "query", schema: { type: "string", default: "1" } },
          { name: "venue", in: "query", schema: { type: "string", enum: ["auto", "mento", "uniswap"], default: "auto" } },
        ],
        responses: {
          "200": {
            description: "Quote with rate, amounts, venue",
            content: { "application/json": { schema: { $ref: "#/components/schemas/SwapQuote" } } },
          },
          "400": { description: "Invalid token pair", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
        },
      },
      post: {
        tags: ["Swap"],
        summary: "Build swap transaction",
        description: "Returns unsigned approval + swap transaction data for Mento Broker.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  fromToken: { type: "string" },
                  toToken: { type: "string" },
                  amount: { type: "string" },
                  slippage: { type: "number", default: 1 },
                },
                required: ["fromToken", "toToken", "amount"],
              },
            },
          },
        },
        responses: {
          "200": { description: "Transaction data (approvalTx + swapTx)" },
          "400": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
        },
      },
    },
    "/api/vault": {
      get: {
        tags: ["Vault"],
        summary: "Vault metrics and deposits",
        description: "TVL, share price, APY, depositor positions.",
        responses: { "200": { description: "Vault metrics and deposits" } },
      },
    },
    "/api/vault/portfolio": {
      get: {
        tags: ["Vault"],
        summary: "Portfolio composition",
        description: "Current allocation vs target (60% cUSD, 25% cEUR, 15% cREAL) with drift analysis.",
        responses: { "200": { description: "Portfolio composition with drift data" } },
      },
    },
    "/api/recurring": {
      get: {
        tags: ["Remittance"],
        summary: "List recurring transfers",
        description: "All recurring transfer schedules with execution counts.",
        responses: { "200": { description: "Recurring transfers list" } },
      },
      post: {
        tags: ["Remittance"],
        summary: "Manage recurring transfers",
        description: "Create, pause, resume, or delete recurring transfer schedules.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  action: { type: "string", enum: ["create", "pause", "resume", "delete"] },
                  fromToken: { type: "string", enum: ["cUSD", "cEUR", "cREAL"] },
                  toToken: { type: "string", enum: ["cUSD", "cEUR", "cREAL"] },
                  amount: { type: "string" },
                  recipientAddress: { type: "string", description: "0x... Celo address" },
                  corridor: { type: "string", description: "e.g. US→MX, EU→PH" },
                  frequency: { type: "string", enum: ["daily", "weekly", "biweekly", "monthly"] },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Recurring transfer created" },
          "200": { description: "Transfer updated" },
          "400": { description: "Validation error" },
        },
      },
    },
    "/api/agent/track-record": {
      get: {
        tags: ["Agent"],
        summary: "Verified track record",
        description: "Performance metrics with TEE attestation. Total trades, volume, P&L, success rate, vault stats.",
        responses: {
          "200": {
            description: "Track record with TEE proof",
            content: { "application/json": { schema: { $ref: "#/components/schemas/TrackRecord" } } },
          },
        },
      },
    },
    "/api/agent/policy": {
      get: {
        tags: ["Agent"],
        summary: "Agent policy and decision log",
        description: "Policy rules (volume limits, spread thresholds), policy hash, and all decision hashes for verification.",
        responses: { "200": { description: "Policy and decision log" } },
      },
    },
    "/api/agent/decisions": {
      get: {
        tags: ["Agent"],
        summary: "Decision audit trail",
        description: "Individual decision hashes. Verify: keccak256(orderId + action + reasoning + timestamp) == hash.",
        responses: { "200": { description: "Array of decision hashes" } },
      },
    },
    "/api/agent/profitability": {
      get: {
        tags: ["Agent"],
        summary: "Dynamic profitability threshold",
        description: "Returns live spread threshold breakdown for a trade size. Formula: max(0.1%, gas/notional + 0.04%, $0.03/notional).",
        parameters: [
          { name: "amount", in: "query", schema: { type: "number", default: 25 }, description: "Trade notional in USD" },
        ],
        responses: {
          "200": { description: "Threshold breakdown with required spread %" },
          "400": { description: "Invalid amount" },
        },
      },
    },
    "/api/agent/analyze": {
      post: {
        tags: ["Agent"],
        summary: "Trigger agent analysis",
        description: "Starts autonomous analysis cycle. Returns Server-Sent Events stream with tool calls, signals, trades, and decisions. Rate-limited: 1 per 30s per IP, or use Bearer token.",
        parameters: [
          { name: "Authorization", in: "header", schema: { type: "string" }, description: "Bearer {AGENT_API_SECRET}" },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  cashFlows: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        token: { type: "string" },
                        amount: { type: "number" },
                        date: { type: "string", format: "date" },
                        note: { type: "string" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "SSE stream with events: iteration, tool_call, signal, order_check, decision_hash, portfolio_drift, complete" },
          "429": { description: "Rate limited", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
          "503": { description: "Agent paused (circuit breaker)", content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } },
        },
      },
    },
    "/api/protocol-health": {
      get: {
        tags: ["Market Data"],
        summary: "Protocol health metrics",
        description: "Mento TVL, Celo chain TVL, 7-day trends via DeFiLlama.",
        responses: { "200": { description: "Protocol health data" } },
      },
    },
    "/api/attestation": {
      get: {
        tags: ["Security"],
        summary: "TEE attestation",
        description: "Intel TDX attestation from Phala Cloud. Proves agent code integrity.",
        responses: { "200": { description: "TEE attestation with status and quote" } },
      },
    },
    "/api/premium-signals": {
      get: {
        tags: ["Signals"],
        summary: "Premium signals (x402)",
        description: "Premium alpha report with live arbitrage data. Requires x402 micropayment (0.10 cUSD via EIP-712 signature).",
        parameters: [
          { name: "X-Payment", in: "header", schema: { type: "string" }, description: "EIP-712 payment signature" },
        ],
        responses: {
          "200": { description: "Premium signals array" },
          "402": { description: "Payment required — returns X-Payment-Required header with payment details" },
        },
      },
    },
    "/api/access-layers": {
      get: {
        tags: ["Protocols"],
        summary: "Interaction access modes",
        description: "Describes dual access: wallet-signed EOA flow and agent-to-agent signed API flow.",
        responses: { "200": { description: "Access layer definitions and auth requirements" } },
      },
    },
    "/api/agent-wallet": {
      post: {
        tags: ["Protocols"],
        summary: "Get per-user agent wallet",
        description: "Creates/returns deterministic thirdweb-backed execution wallet for a connected EOA user.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  requester: { type: "string", description: "EOA address" },
                  signature: { type: "string", description: "Wallet signature over access message" },
                  timestamp: { type: "number" },
                },
                required: ["requester", "signature", "timestamp"],
              },
            },
          },
        },
        responses: {
          "200": { description: "Derived wallet + balances" },
          "400": { description: "Invalid request" },
          "401": { description: "Invalid signature" },
        },
      },
    },
    "/.well-known/agent-card.json": {
      get: {
        tags: ["Protocols"],
        summary: "A2A Agent Card",
        description: "Agent-to-Agent protocol discovery. Returns agent capabilities, skills, and communication endpoint.",
        responses: { "200": { description: "A2A agent card manifest" } },
      },
    },
    "/.well-known/mcp.json": {
      get: {
        tags: ["Protocols"],
        summary: "MCP server manifest",
        description: "Model Context Protocol server capabilities with tool, prompt, and resource discovery.",
        responses: { "200": { description: "MCP server manifest" } },
      },
    },
    "/.well-known/agent.json": {
      get: {
        tags: ["Protocols"],
        summary: "Agent discovery alias",
        description: "Scanner-friendly discovery alias with MCP/A2A/x402 endpoints and registration identifiers.",
        responses: { "200": { description: "Agent discovery metadata" } },
      },
    },
    "/.well-known/agent-registration.json": {
      get: {
        tags: ["Protocols"],
        summary: "ERC-8004 registration",
        description: "On-chain agent identity. Agent #10 on Celo Identity Registry (0x8004).",
        responses: { "200": { description: "ERC-8004 registration metadata" } },
      },
    },
  },
  components: {
    schemas: {
      ApiError: {
        type: "object",
        properties: {
          error: { type: "string", description: "Human-readable error message" },
          code: {
            type: "string",
            enum: [
              "RATE_LIMITED", "AGENT_PAUSED", "VOLUME_LIMIT_EXCEEDED", "SPREAD_TOO_LOW",
              "SPREAD_NEGATIVE", "ORDER_NOT_FOUND", "ORDER_EXPIRED", "ORDER_NOT_PENDING",
              "RATE_BELOW_TARGET", "INVALID_TOKEN", "INVALID_ADDRESS", "INVALID_CREATOR", "INVALID_AMOUNT",
              "INVALID_SLIPPAGE", "INVALID_TIMESTAMP", "INVALID_SIGNATURE",
              "MISSING_FIELDS", "MISSING_PRIVATE_KEY", "NO_POOL_FOUND", "QUOTE_FAILED",
              "SWAP_FAILED", "TRANSFER_FAILED", "ARB_SPREAD_TOO_LOW", "INTERNAL_ERROR",
            ],
            description: "Machine-readable error code for programmatic handling",
          },
          details: { type: "object", description: "Additional context (thresholds, limits, rates)" },
        },
        required: ["error", "code"],
      },
      AssetPrice: {
        type: "object",
        properties: {
          symbol: { type: "string", example: "EUR/USD" },
          name: { type: "string", example: "Euro / US Dollar" },
          price: { type: "number", example: 1.0821 },
          change24h: { type: "number", example: -0.15 },
        },
      },
      MentoRate: {
        type: "object",
        properties: {
          pair: { type: "string", example: "cUSD/cEUR" },
          mentoRate: { type: "number", example: 0.9265, description: "On-chain Mento Broker rate" },
          forexRate: { type: "number", example: 0.926, description: "Real-world forex rate" },
          spread: { type: "number", example: 0.0005 },
          spreadPct: { type: "number", example: 0.054, description: "Spread as percentage" },
          direction: { type: "string", enum: ["buy", "sell", "neutral"] },
          source: { type: "string", enum: ["on-chain"] },
          exchangeId: { type: "string", description: "Mento BiPoolManager exchange ID" },
          forexAge: { type: "integer", description: "Seconds since forex data was fetched" },
        },
      },
      CrossVenueRate: {
        type: "object",
        properties: {
          pair: { type: "string", example: "cUSD/cEUR" },
          mentoRate: { type: "number", nullable: true },
          uniswapRate: { type: "number", nullable: true },
          forexRate: { type: "number" },
          venueSpread: { type: "number", nullable: true, description: "Mento vs Uniswap spread %" },
          mentoVsForex: { type: "number", nullable: true },
          uniswapVsForex: { type: "number", nullable: true },
          bestVenue: { type: "string", enum: ["mento", "uniswap", "tied"] },
        },
      },
      Signal: {
        type: "object",
        properties: {
          id: { type: "string" },
          market: { type: "string", enum: ["crypto", "forex", "commodities", "mento"] },
          asset: { type: "string", example: "cUSD/cEUR" },
          direction: { type: "string", enum: ["long", "short", "hold"] },
          confidence: { type: "number", minimum: 0, maximum: 100 },
          summary: { type: "string" },
          reasoning: { type: "string" },
          entryPrice: { type: "number" },
          targetPrice: { type: "number" },
          stopLoss: { type: "number" },
          tier: { type: "string", enum: ["free", "premium"] },
          timestamp: { type: "integer", description: "Unix ms" },
        },
      },
      Trade: {
        type: "object",
        properties: {
          id: { type: "string" },
          pair: { type: "string" },
          fromToken: { type: "string" },
          toToken: { type: "string" },
          amountIn: { type: "string" },
          amountOut: { type: "string" },
          rate: { type: "number" },
          spreadPct: { type: "number" },
          status: { type: "string", enum: ["pending", "confirmed", "failed"] },
          approvalTxHash: { type: "string", description: "Celoscan: explorer.celo.org/tx/{hash}" },
          swapTxHash: { type: "string" },
          pnl: { type: "number" },
          timestamp: { type: "integer" },
        },
      },
      FxOrder: {
        type: "object",
        properties: {
          id: { type: "string" },
          creator: { type: "string" },
          fromToken: { type: "string" },
          toToken: { type: "string" },
          amountIn: { type: "string" },
          targetRate: { type: "number" },
          deadline: { type: "integer" },
          status: { type: "string", enum: ["pending", "executed", "expired", "cancelled"] },
          conditionType: { type: "string", enum: ["rate_reaches", "pct_change", "rate_crosses_above", "rate_crosses_below"] },
          pctChangeThreshold: { type: "number" },
          referenceRate: { type: "number", description: "Rate snapshot at order creation" },
          executedRate: { type: "number" },
          executedTxHash: { type: "string" },
          agentReasoning: { type: "string" },
        },
      },
      SwapQuote: {
        type: "object",
        properties: {
          tokenIn: { type: "string" },
          tokenOut: { type: "string" },
          amountIn: { type: "string" },
          amountOut: { type: "string" },
          rate: { type: "number" },
          venue: { type: "string", enum: ["mento", "uniswap-v3"] },
          exchangeId: { type: "string" },
          fee: { type: "integer", description: "Uniswap pool fee in bps" },
        },
      },
      TrackRecord: {
        type: "object",
        properties: {
          agentId: { type: "integer", example: 10 },
          wallet: { type: "string" },
          chain: { type: "string", example: "celo" },
          tee: {
            type: "object",
            properties: {
              status: { type: "string" },
              verified: { type: "boolean" },
              hardware: { type: "string", example: "Intel TDX" },
              provider: { type: "string", example: "Phala Cloud" },
            },
          },
          performance: {
            type: "object",
            properties: {
              totalTrades: { type: "integer" },
              confirmedTrades: { type: "integer" },
              successRate: { type: "integer" },
              totalVolume: { type: "number" },
              avgSpreadCaptured: { type: "number" },
              cumulativePnlPct: { type: "number" },
              pairsTraded: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
      HealthResponse: {
        type: "object",
        properties: {
          status: { type: "string", example: "healthy" },
          agentId: { type: "integer", example: 10 },
          chain: { type: "string", example: "celo" },
          timestamp: { type: "string", format: "date-time" },
          services: {
            type: "object",
            properties: {
              a2a: { type: "object", properties: { status: { type: "string" }, skills: { type: "integer" } } },
              mcp: { type: "object", properties: { status: { type: "string" }, tools: { type: "integer" } } },
              web: { type: "object", properties: { status: { type: "string" } } },
              tee: { type: "object", properties: { status: { type: "string" } } },
            },
          },
          stats: {
            type: "object",
            properties: {
              trades: { type: "integer" },
              vaultTvl: { type: "number" },
              vaultDepositors: { type: "integer" },
            },
          },
        },
      },
    },
  },
};

export async function GET() {
  const spec = JSON.parse(JSON.stringify(SPEC));
  spec.servers[0].url = getBaseUrl();
  return NextResponse.json(spec, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
