# CeloFX — Autonomous FX Agent on Celo

AI-powered FX arbitrage agent that compares real forex rates with Mento on-chain stablecoin rates, reasons about market conditions using Claude, and executes trades autonomously. The agent doesn't just check `if rate >= target` — it analyzes momentum, volatility, urgency, and forex correlation before deciding whether to execute, wait, or skip.

**Live**: [celofx.vercel.app](https://celofx.vercel.app)
**Agent**: [8004scan.io/agents/celo/10](https://8004scan.io/agents/celo/10)

---

## Public Documentation

Detailed demo scripts, execution logic, and internal scoring strategy are intentionally kept private.
This public README only covers high-level architecture and integration surface.

---

## Architecture

```
                    ┌─────────────────────┐
                    │   Frankfurter API   │ Real forex rates
                    │   (EUR/USD, BRL)    │ (EUR/USD, USD/BRL)
                    └─────────┬───────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                     Claude AI (Sonnet 4.5)                       │
│                                                                  │
│  Tools (16):                     Decision Engine:                │
│  ├─ fetch_mento_rates            ├─ momentum (last 3 rates)     │
│  ├─ fetch_cross_venue_rates      ├─ volatility (std dev)        │
│  ├─ fetch_forex / crypto / comm  ├─ urgency (time to deadline)  │
│  ├─ check_pending_orders ──────► ├─ forex signal (trend)        │
│  ├─ execute_order ◄──────────────├─ spread vs forex             │
│  ├─ execute_mento_swap           ├─ gas threshold check         │
│  ├─ execute_uniswap_swap         │                              │
│  ├─ execute_cross_dex_arb        │  EXECUTE / WAIT / SKIP       │
│  ├─ execute_remittance           │  + detailed reasoning        │
│  ├─ check_recurring_transfers    └──────────────────────────────│
│  ├─ check_portfolio_drift                                       │
│  └─ get_rebalance_history                                       │
│                                                                  │
└───────────┬────────────────────────────────┬─────────────────────┘
            │                                │
            ▼                                ▼
┌───────────────────────┐      ┌─────────────────────────┐
│   Mento Broker        │      │   Agent Wallet           │
│   (0x777A on Celo)    │      │   (0x6652...a303)        │
│                       │      │                          │
│   getAmountOut()      │      │   approve() + swapIn()   │
│   4 directions        │      │   CIP-64 fee abstraction │
│   cUSD ↔ cEUR         │      │   (gas paid in cUSD)     │
│   cUSD ↔ cREAL        │      │                          │
└───────────────────────┘      └─────────────────────────┘
            │                                │
            └──────────────┬─────────────────┘
                           ▼
              ┌────────────────────────┐
              │   Celo Mainnet         │
              │                        │
              │   ERC-8004 Identity    │
              │   ERC-8004 Reputation  │
              │   MCP Server (8 tools) │
              │   A2A Endpoint         │
              │   x402 Payments        │
              └────────────────────────┘
```

### Agent Protocol Support

| Protocol | Endpoint | What It Does |
|----------|----------|-------------|
| **MCP** | `/api/mcp` | 8 tools: rates, cross-venue, signals, trades, performance, agent info, policy, decisions |
| **A2A** | `/api/a2a` | 4 skills: rate analysis, swap execution, portfolio, performance |
| **x402** | `/api/premium-signals` | HTTP 402 paywall, $0.10 cUSD per premium alpha report |
| **ERC-8004** | On-chain | Identity (#10) + Reputation Registry with on-chain feedback |
| **TEE** | Phala Cloud | Intel TDX attestation (Dockerfile + docker-compose included) |

### Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind v4, shadcn/ui, wagmi, viem, RainbowKit
- **AI Agent**: Claude Sonnet 4.5 with tool-use (16 tools in agentic loop)
- **On-Chain**: Mento Broker for stablecoin swaps, ERC-8004 for identity/reputation
- **Payments**: x402 protocol with EIP-712 signatures
- **Chain**: Celo mainnet (not testnet)

## How Mento FX Arbitrage Works

```
1. Agent fetches Mento Broker on-chain rate: getAmountOut(1 cUSD → cEUR) = 0.8357
2. Agent fetches real forex rate: EUR/USD = 1.1886 → inverted = 0.8413
3. Spread = (0.8357 - 0.8413) / 0.8413 = -0.67%
4. Checks ALL 4 directions (cUSD↔cEUR, cUSD↔cREAL) — one side may be profitable
5. If any spread > +0.1%: execute_mento_swap for that direction (runtime enforces dynamic threshold)
6. If all < +0.1%: generate monitoring signals, check pending orders
```

## How Smart FX Orders Work

```
User creates order: "Swap 50 cUSD → cEUR when rate hits 0.845, deadline 48h"
                                    │
                    ┌───────────────▼──────────────────┐
                    │  check_pending_orders (no-execute) │
                    │                                    │
                    │  For each order:                   │
                    │  ├─ Fetch fresh on-chain quote     │
                    │  ├─ Append to rateHistory (cap 20) │
                    │  ├─ Compute momentum (3 points)    │
                    │  ├─ Compute volatility (std dev)   │
                    │  ├─ Compute urgency (deadline)     │
                    │  ├─ Fetch forex, compute spread    │
                    │  └─ Return analysis to Claude      │
                    └───────────────┬──────────────────┘
                                    │
                    ┌───────────────▼──────────────────┐
                    │  Claude reasons per order          │
                    │                                    │
                    │  "Rate 0.841, target 0.845,        │
                    │   momentum improving, volatility   │
                    │   low, urgency low, forex          │
                    │   favorable — WAIT, let it climb"  │
                    │                                    │
                    │  OR: "momentum declining, lock in"  │
                    │   → calls execute_order(orderId,   │
                    │     reasoning)                     │
                    └────────────────────────────────────┘
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard: agent wallet, Mento spreads, top signals, markets, activity feed |
| `/orders` | Smart FX Orders with sparklines, momentum/urgency badges, agent reasoning |
| `/signals` | Full signal feed with market filters (Mento/Forex/Crypto/Commodities) |
| `/trades` | All executed swaps with stats (volume, success rate, P&L) |
| `/premium` | x402-gated premium alpha report ($0.10 per unlock) |
| `/agent` | ERC-8004 agent profile, reputation, execution timeline |
| `/vault` | Capital vault for depositors |
| `/developers` | Integration guide: MCP, A2A, REST API, x402 with live "Try it" demos |
| `/security` | Security & Trust: agent policy, decision hashing, TEE, auditability |

## Key Source Files

| File | What It Does |
|------|-------------|
| [`agent-tools.ts`](frontend/src/lib/agent-tools.ts) | 16 tool definitions + decision framework system prompt |
| [`analyze/route.ts`](frontend/src/app/api/agent/analyze/route.ts) | Agentic loop: fetch data → analyze orders → execute with reasoning |
| [`agent-policy.ts`](frontend/src/lib/agent-policy.ts) | Standing Intent, decision hashing, volume tracking, circuit breaker |
| [`mento-sdk.ts`](frontend/src/lib/mento-sdk.ts) | On-chain Mento Broker (`getAmountOut`, `swapIn`, bidirectional quotes) |
| [`decisions/route.ts`](frontend/src/app/api/agent/decisions/route.ts) | Decision audit API: query/verify committed decision hashes |
| [`api/[transport]/route.ts`](frontend/src/app/api/[transport]/route.ts) | MCP server with 5 tools (rate analysis, signals, trades, performance) |
| [`api/a2a/route.ts`](frontend/src/app/api/a2a/route.ts) | A2A endpoint with JSON-RPC task handling |
| [`orders/page.tsx`](frontend/src/app/orders/page.tsx) | Orders UI with sparklines, momentum badges, agent reasoning |

## Running Locally

```bash
cd frontend
pnpm install
cp .env.example .env.local
# Add your keys to .env.local
pnpm dev
```

### Environment Variables

```
NEXT_PUBLIC_WC_PROJECT_ID=       # WalletConnect project ID
NEXT_PUBLIC_AGENT_ID=10          # ERC-8004 agent ID
ANTHROPIC_API_KEY=               # Claude API key
AGENT_PRIVATE_KEY=               # Agent wallet private key (for auto-execution)
AGENT_WALLET_ADDRESS=            # Wallet address for x402 payments
THIRDWEB_SECRET_KEY=             # thirdweb x402 facilitator key
CRON_SECRET=                     # Vercel cron authentication
```

## Why This Matters

Stablecoin FX on Mento is underserved. EUR/USD trades at $7.5T daily, but Mento's cUSD/cEUR pair has minimal automated arbitrage. When Mento rates drift from real forex, spreads open up.

Most existing solutions are either manual or use simple limit orders. CeloFX is the first agent that reasons about *when* to execute — factoring in rate momentum, market volatility, forex divergence, and deadline urgency — then executes with transparent, auditable reasoning.

| | Manual FX | Simple Bot | CeloFX |
|---|---|---|---|
| Decision intelligence | Human judgment | `if rate >= target` | Claude with 7-condition framework |
| Forex awareness | Yes | No | Yes (Frankfurter API correlation) |
| Momentum tracking | No | No | Yes (rate history + std dev) |
| Multi-venue arbitrage | No | No | Yes (Mento + Uniswap V3 cross-DEX) |
| Gas-aware execution | No | No | Yes (rejects if gas > 50% of profit) |
| On-chain execution | Manual | Yes | Yes (Mento + Uniswap + CIP-64) |
| Portfolio hedging | No | No | Yes (60/25/15 auto-rebalance) |
| Remittance | No | No | Yes (swap + transfer, recurring) |
| Auditable reasoning | No | No | Yes (keccak256 decision hashing) |
| On-chain identity | No | No | ERC-8004 (#10) |
| Agent protocols | No | No | MCP (8) + A2A (4) + x402 + TEE |
