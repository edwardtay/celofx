# CeloFX — Autonomous FX Agent on Celo

AI-powered FX arbitrage agent that compares real forex rates with Mento on-chain stablecoin rates, reasons about market conditions using Claude, and executes trades autonomously. The agent doesn't just check `if rate >= target` — it analyzes momentum, volatility, urgency, and forex correlation before deciding whether to execute, wait, or skip.

**Live**: [celofx.vercel.app](https://celofx.vercel.app)
**Agent**: [8004scan.io/agents/celo/10](https://8004scan.io/agents/celo/10)

---

## For Hackathon Judges

### Demo Flow (3 minutes)

1. **Dashboard** ([celofx.vercel.app](https://celofx.vercel.app)) — Agent wallet with live balances, Mento FX spread comparisons, top signals, market data
2. **Click "Scan Markets"** — Watch the agent fetch Mento on-chain rates, forex, crypto, and commodities via tool-use loop (~30s)
3. **Order Execution** — Agent calls `check_pending_orders`, receives per-order analysis (momentum, volatility, urgency, forex signal), then reasons through each order and calls `execute_order` with detailed reasoning — or explains why it's waiting
4. **Orders** ([/orders](https://celofx.vercel.app/orders)) — Smart FX Orders with rate sparklines, momentum/urgency badges, and agent reasoning shown inline
5. **Trades** ([/trades](https://celofx.vercel.app/trades)) — Real on-chain swaps with Celoscan links. $5+ volume, 100% success rate
6. **Premium** ([/premium](https://celofx.vercel.app/premium)) — x402 paywall: real HTTP 402, EIP-712 payment, $0.01 cUSD
7. **Developers** ([/developers](https://celofx.vercel.app/developers)) — Integration portal: MCP config, A2A agent card, REST API with live "Try it" buttons, x402 payment flow
8. **Security** ([/security](https://celofx.vercel.app/security)) — Standing Intent policy (keccak256-hashed), decision framework, TEE attestation, on-chain auditability
9. **Agent** ([/agent](https://celofx.vercel.app/agent)) — ERC-8004 identity (#10), on-chain reputation, execution timeline

### Judging Criteria Alignment

| Criterion | How CeloFX Delivers |
|-----------|---------------------|
| **Technical Innovation** | Multi-venue DEX arbitrage (Mento + Uniswap V3), Claude AI decision engine with 7-condition framework, cross-market correlation (Mento vs forex), 16 agent tools in agentic loop, gas threshold risk management |
| **Developer Experience** | 3 protocols (MCP 8 tools, A2A 4 skills, x402), OpenAPI spec 25+ endpoints, "Try it" buttons on /developers, structured error codes, rate limit headers |
| **Security & Trust** | Circuit breaker, volume limits (500 cUSD/24h), decision hashing (keccak256 before execution), TEE-ready (Intel TDX via Phala Cloud), profitability guards (+0.3% min spread), gas price validation, Standing Intent policy |
| **Real-World Applicability** | 4 FX use cases in one agent: Arbitrage (#10), Hedging (#4), Trading/Alerts (#6), Remittance (#1). Real on-chain volume, verified Celoscan trades, hedged portfolio vault, cross-border remittance with FX optimization |

### 4 FX Use Cases — One Agent

| Use Case | What CeloFX Does | Key Tools |
|----------|-------------------|-----------|
| **Arbitrage** (#10) | Cross-DEX arb between Mento Broker and Uniswap V3 when venue spread > 0.3%. Stablecoin peg monitoring (USDT/cUSD). | `execute_cross_dex_arb`, `execute_uniswap_swap`, `fetch_cross_venue_rates` |
| **Hedging** (#4) | Portfolio vault with 60/25/15 target allocation (cUSD/cEUR/cREAL). Auto-rebalances when drift > 5%. Cash flow integration reduces unnecessary swaps. | `check_portfolio_drift`, `execute_mento_swap`, `get_rebalance_history` |
| **Trading/Alerts** (#6) | Smart FX Orders with 4 condition types (rate_reaches, pct_change, crosses_above, crosses_below). AI reasons through momentum, volatility, urgency, forex correlation. | `check_pending_orders`, `execute_order`, `generate_signal` |
| **Remittance** (#1) | Agent-initiated cross-border transfers: swap via Mento + ERC-20 transfer to recipient. Recurring schedules with FX timing optimization. | `execute_remittance`, `check_recurring_transfers` |

### What Makes This Different

Most "AI agent" hackathon projects are chatbot wrappers — the AI generates text but doesn't make real decisions. CeloFX is different:

- **AI is the decision-maker** — Claude receives rich market data (momentum, volatility, urgency, forex divergence) and decides per-order whether to execute, wait, or skip. The decision framework has 7+ conditions the agent reasons through.
- **Real on-chain execution** — Agent wallet (`0x6652...a303`) holds stablecoins and executes real Mento Broker + Uniswap V3 swaps with CIP-64 fee abstraction (gas paid in cUSD). Verified trades on Celo mainnet.
- **Gas-aware profitability** — Before every swap, the agent checks Celo gas price and rejects trades where gas cost > 50% of expected profit. Capital protection is automated, not manual.
- **Policy enforcement, not just declaration** — Daily volume cap (500 cUSD / 24h), circuit breaker, profitability guard (+0.3% min spread), gas threshold — all enforced in code before every swap. Hard runtime limits.
- **Decision audit trail** — Every execution is hashed with `keccak256(orderId, action, reasoning, timestamp)` BEFORE the swap tx is sent. Decision log is publicly queryable via [`/api/agent/decisions`](https://celofx.vercel.app/api/agent/decisions).
- **Forex-aware order engine** — Orders aren't simple limit orders. The agent checks if Mento rate vs real forex spread is favorable, if forex is trending toward or away from target, and adjusts execution timing accordingly.
- **Cross-DEX arbitrage** — Monitors price differences between Mento and Uniswap V3, executes buy-cheap-sell-expensive two-leg arbs.
- **24 real on-chain reputation feedbacks** — 12 unique clients on ERC-8004 Reputation Registry. All verifiable on Celoscan.

### The Decision Engine

When the agent evaluates an order, it sees:

```
{
  currentRate: 0.841,     // Live Mento Broker rate
  targetRate: 0.845,      // User's target
  momentum: "improving",  // Rate trend (last 3 data points)
  volatility: "low",      // Rate swing magnitude
  urgency: "low",         // Time to deadline
  forexRate: 0.926,       // Real EUR/USD from Frankfurter
  spreadVsForexPct: -9.2, // Mento vs forex spread
  forexSignal: "favorable" // Is forex trending toward target?
}
```

Then reasons through rules like:
- Rate at target + declining momentum → **EXECUTE** (lock in before it drops)
- Rate at target + improving momentum + low urgency → **WAIT** (let it climb)
- Rate below target + high urgency + gap < 1% → **EXECUTE** at market (better than expiring)
- Spread vs forex < -1% → **NEVER EXECUTE** (forex disagrees, Mento will correct)

### Security & Trust Minimization

The agent's policy is not just a document — every limit is enforced at runtime:

| Guard | How It Works | Endpoint |
|-------|-------------|----------|
| **Daily volume cap** | Rolling 24h window, rejects swaps over 500 cUSD | `checkVolumeLimit()` in every swap handler |
| **Profitability guard** | Double-checks on-chain rate vs forex BEFORE swap. Rejects if spread < +0.3% | Protects vault depositors from negative trades |
| **Circuit breaker** | `AGENT_PAUSED=true` halts all execution with 503 | Emergency kill switch |
| **Decision hashing** | `keccak256(orderId, action, reasoning, timestamp)` committed BEFORE swap tx | [`/api/agent/decisions`](https://celofx.vercel.app/api/agent/decisions) |
| **Standing Intent** | Cryptographically signed policy: allowed tokens, protocols, spending limits | [`/api/agent/policy`](https://celofx.vercel.app/api/agent/policy) |
| **TEE attestation** | TEE-ready: Intel TDX via Phala Cloud CVM with Dockerfile + docker-compose included | [`/api/tee/attestation`](https://celofx.vercel.app/api/tee/attestation) |

Verify a decision hash:
```bash
# Get all committed decisions
curl https://celofx.vercel.app/api/agent/decisions

# Verify a specific hash
curl -X POST https://celofx.vercel.app/api/agent/decisions \
  -H "Content-Type: application/json" \
  -d '{"orderId":"...","action":"execute","reasoning":"...","timestamp":...,"expectedHash":"0x..."}'
```

### Verify On-Chain

| What | Link |
|------|------|
| Agent Wallet | [celoscan.io/address/0x6652...](https://celoscan.io/address/0x6652AcDc623b7CCd52E115161d84b949bAf3a303) |
| Swap: cUSD → cEUR | [celoscan.io/tx/0x9978b5...](https://celoscan.io/tx/0x9978b5be04f1641ef99c98caa3115ca4654a77fbb7e4bdffef87ae045fb9d808) |
| Swap: cUSD → cREAL | [celoscan.io/tx/0xf06729...](https://celoscan.io/tx/0xf0672921205c035c95a3c52d3e83875f282b52118001bbbe84e8307d436dc7a3) |
| Swap: cEUR → cUSD | [celoscan.io/tx/0x49e855...](https://celoscan.io/tx/0x49e855cd09b86eec045fa9fceda35b7cc23e1d3cb11dc223525dbf1c0c26ff18) |
| Reputation: 92/100 | [celoscan.io/tx/0x4794f3...](https://celoscan.io/tx/0x4794f3cd023edfd0796e265d79e0ff8bc0642e88b2684067ba1c75ed628a6e48) |
| Reputation: 87/100 | [celoscan.io/tx/0xefe240...](https://celoscan.io/tx/0xefe240d4a7209af60a962229a7ca93f14f911e8ab932671060aa32c12ece6e3f) |
| Agent #10 (8004scan) | [8004scan.io/agents/celo/10](https://8004scan.io/agents/celo/10) |
| Mento Broker | [celoscan.io/address/0x777A...](https://celoscan.io/address/0x777A8255cA72412f0d706dc03C9D1987306B4CaD) |
| Identity Registry | [celoscan.io/address/0x8004A1...](https://celoscan.io/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432) |
| Reputation Registry | [celoscan.io/address/0x8004BA...](https://celoscan.io/address/0x8004BAa17C55a88189AE136b182e5fdA19dE9b63) |

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
| **x402** | `/api/premium-signals` | HTTP 402 paywall, $0.01 cUSD per premium signal unlock |
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
5. If any spread > +0.3%: execute_mento_swap for that direction
6. If all < +0.3%: generate monitoring signals, check pending orders
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
| `/premium` | x402-gated premium signals ($0.01 per unlock) |
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
