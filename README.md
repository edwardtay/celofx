# CeloFX — Autonomous FX Agent

AI-powered FX arbitrage agent on Celo. Compares real forex rates with Mento on-chain stablecoin rates, finds swap opportunities, and executes trades autonomously. Registered on-chain via ERC-8004, monetized via x402 micropayments.

**Live**: [celofx.vercel.app](https://celofx.vercel.app)

---

## For Hackathon Judges

### Demo Flow (2 minutes)

1. **Dashboard** ([celofx.vercel.app](https://celofx.vercel.app)) — See Agent #4 status, live agent wallet (CELO balance, 3 trades, +0.88% P&L), Mento FX spread comparisons, top signals, and market data
2. **Click "Scan Markets"** — Watch the agent fetch Mento on-chain rates, forex, crypto, and commodities, then Claude AI generates 5 cross-market signals with tool-call logging (~30s)
3. **Mento FX Spreads** — Real-time comparison: Mento Broker `getAmountOut()` vs real EUR/USD and USD/BRL forex rates. When spread > 0.3%, agent auto-swaps
4. **Trades** ([/trades](https://celofx.vercel.app/trades)) — 3 real on-chain swaps with Celoscan links for both approval and swap transactions. $5.00 volume, 100% success rate, +0.88% cumulative P&L
5. **Signals** ([/signals](https://celofx.vercel.app/signals)) — AI-generated signals across 4 markets: Mento FX, Forex, Crypto, Commodities
6. **Premium** ([/premium](https://celofx.vercel.app/premium)) — x402 paywall: real HTTP 402 response, EIP-712 payment signing, $0.01 in cUSD. [Demo link](https://celofx.vercel.app/premium?demo=true) works without wallet
7. **Agent** ([/agent](https://celofx.vercel.app/agent)) — On-chain identity (Agent #4), reputation (5 feedbacks), execution timeline, architecture diagram

### What Makes This Different

- **Real on-chain trades** — 3 executed Mento swaps with real tx hashes on Celoscan (not simulated)
- **Autonomous execution** — Agent has its own wallet (`0x1e67...2b23`), private key, and daily cron job. No human intervention required
- **Mento FX arbitrage** — Compares real forex rates (EUR/USD, USD/BRL) with Mento Broker on-chain rates to find stablecoin swap opportunities
- **7 agent tools** — `fetch_mento_rates`, `fetch_forex`, `fetch_crypto`, `fetch_commodities`, `generate_signal`, `generate_fx_action`, `execute_mento_swap`
- **Tool-call logging** — Every Claude tool invocation is logged and displayed in a terminal UI during analysis
- **Both ERC-8004 registries** — Identity (agent profile on-chain) AND Reputation (user feedback on-chain)
- **Real x402 implementation** — HTTP 402 headers, `@x402/core` encoding, `@x402/fetch` client, EIP-712 signatures
- **Celo mainnet** — Not testnet. Real cUSD payments, real Mento swaps, real on-chain data

### Verify On-Chain

| What | Link |
|------|------|
| Agent Wallet | [celoscan.io/address/0x1e67...2b23](https://celoscan.io/address/0x1e67A381c93F34afAed8c1A7E5E35746f8bE2b23) |
| Swap: cUSD → cEUR | [celoscan.io/tx/0x9978b5...](https://celoscan.io/tx/0x9978b5be04f1641ef99c98caa3115ca4654a77fbb7e4bdffef87ae045fb9d808) |
| Swap: cUSD → cREAL | [celoscan.io/tx/0xf06729...](https://celoscan.io/tx/0xf0672921205c035c95a3c52d3e83875f282b52118001bbbe84e8307d436dc7a3) |
| Swap: cEUR → cUSD | [celoscan.io/tx/0x49e855...](https://celoscan.io/tx/0x49e855cd09b86eec045fa9fceda35b7cc23e1d3cb11dc223525dbf1c0c26ff18) |
| Agent #4 Registration | [celoscan.io/tx/0xea64b5d...](https://celoscan.io/tx/0xea64b5d790028208b285bb05a00cb506b44f7fa6d10099cff6671bd42e9a3ab6) |
| Mento Broker | [celoscan.io/address/0x777A...4CaD](https://celoscan.io/address/0x777A8255cA72412f0d706dc03C9D1987306B4CaD) |
| Identity Registry | [celoscan.io/address/0x8004A1...](https://celoscan.io/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432) |
| Reputation Registry | [celoscan.io/address/0x8004BA...](https://celoscan.io/address/0x8004BAa17C55a88189AE136b182e5fdA19dE9b63) |

### Key Source Files

| File | What It Does |
|------|-------------|
| [`agent-tools.ts`](frontend/src/lib/agent-tools.ts) | Claude agent system prompt + 7 tool definitions |
| [`analyze/route.ts`](frontend/src/app/api/agent/analyze/route.ts) | Agentic loop: fetch markets → analyze → execute swaps |
| [`mento-sdk.ts`](frontend/src/lib/mento-sdk.ts) | On-chain Mento Broker integration (`getAmountOut`, `swapIn`) |
| [`agent-status.tsx`](frontend/src/components/dashboard/agent-status.tsx) | Scan UI with tool-call logging terminal |
| [`agent-wallet.tsx`](frontend/src/components/dashboard/agent-wallet.tsx) | Live on-chain wallet balances via viem |
| [`premium-gate.tsx`](frontend/src/components/premium/premium-gate.tsx) | x402 payment flow with step-by-step visualization |
| [`premium-signals/route.ts`](frontend/src/app/api/premium-signals/route.ts) | HTTP 402 endpoint with `@x402/core` headers |
| [`mento-spreads.tsx`](frontend/src/components/dashboard/mento-spreads.tsx) | Real-time Mento vs forex spread comparison |
| [`cron/scan/route.ts`](frontend/src/app/api/cron/scan/route.ts) | Daily autonomous scan (Vercel cron, 8:00 UTC) |

---

## What It Does

CeloFX is an autonomous FX agent that:

1. **Compares Mento and forex rates** — Reads real-time `getAmountOut()` from Mento Broker contract, compares against EUR/USD and USD/BRL forex rates
2. **Finds swap opportunities** — When Mento stablecoin rates differ from real forex by > 0.3%, the agent identifies an arbitrage opportunity
3. **Executes autonomously** — Agent wallet holds cUSD/cEUR/cREAL, auto-approves and swaps via Mento Broker when spreads are favorable
4. **Generates cross-market signals** — Claude AI analyzes forex, crypto, commodities, and Mento data to generate 3-5 actionable signals per scan
5. **Runs on a schedule** — Vercel cron triggers daily scan at 8:00 UTC. No human intervention.
6. **Builds verifiable reputation** — Every trade and signal contributes to an on-chain track record via ERC-8004

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                       Next.js Frontend (5 pages)                  │
│  Dashboard │ Signals │ Trades │ Premium (x402) │ Agent (ERC-8004)│
└──────┬──────────┬─────────┬────────────┬──────────────┬──────────┘
       │          │         │            │              │
       ▼          ▼         ▼            ▼              ▼
┌──────────┐ ┌────────┐ ┌────────┐ ┌─────────┐ ┌──────────────┐
│ Mento    │ │ Signal │ │ Trade  │ │  x402   │ │   ERC-8004   │
│ Broker   │ │ Store  │ │ Store  │ │ Payment │ │   Identity   │
│ (on-chain│ │        │ │        │ │ Gate    │ │ + Reputation │
│  rates)  │ │        │ │        │ │         │ │              │
└──────────┘ └───┬────┘ └───┬────┘ └─────────┘ └──────────────┘
                 │          │                         │
                 ▼          ▼                         ▼
          ┌────────────┐ ┌──────────┐       ┌────────────────┐
          │ Claude AI  │ │  Agent   │       │ Celo Mainnet   │
          │ 7 Tools    │ │  Wallet  │       │   (on-chain)   │
          │ 3 iters    │ │  0x1e67  │       └────────────────┘
          └────────────┘ └──────────┘
```

### Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind v4, shadcn/ui, wagmi, viem, RainbowKit
- **AI Agent**: Claude Sonnet 4.5 with tool-use (7 tools in agentic loop, ~3 iterations per scan)
- **On-Chain**: Mento Broker for stablecoin swaps, ERC-8004 for identity/reputation
- **Payments**: x402 protocol — HTTP 402 with `X-PAYMENT-REQUIRED` header, $0.01 cUSD per signal
- **Chain**: Celo mainnet

## How Mento FX Arbitrage Works

```
1. Agent fetches Mento Broker on-chain rate: getAmountOut(1 cUSD → cEUR) = 0.8357
2. Agent fetches real forex rate: EUR/USD = 1.1886 → inverted = 0.8413
3. Spread = (0.8357 - 0.8413) / 0.8413 = -0.67%
4. If spread > 0.3%: Agent swaps via Mento Broker (approve + swapIn)
5. If spread < 0.3%: Agent generates "Wait" or "Monitor" signal
```

The agent executed 3 real swaps capturing spreads of +0.42%, +0.15%, and +0.31%.

## How x402 Works Here

```
User clicks "Unlock Premium"
  → Client fetches GET /api/premium-signals
  → Server returns HTTP 402 + X-PAYMENT-REQUIRED header
  → @x402/fetch reads requirements (scheme: exact, $0.01 cUSD, eip155:42220)
  → Wallet signs EIP-712 payment authorization (no gas)
  → Client retries with X-PAYMENT header
  → Server decodes + verifies → returns premium signals
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard: agent wallet, Mento spreads, top signals, markets, activity feed, track record |
| `/signals` | Full signal feed with market filters (Mento/Forex/Crypto/Commodities) |
| `/trades` | All executed swaps with stats (volume, success rate, P&L, spread) |
| `/premium` | x402-gated premium signals ($0.01 per unlock) |
| `/agent` | ERC-8004 agent profile, reputation, execution timeline |

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/agent/analyze` | POST | Triggers Claude AI analysis + auto-swap cycle |
| `/api/agent/track-record` | GET | Public performance metrics JSON |
| `/api/cron/scan` | GET | Vercel cron endpoint (daily 8:00 UTC) |
| `/api/signals` | GET | Free-tier signals |
| `/api/trades` | GET | All executed trades |
| `/api/premium-signals` | GET | x402-protected premium signals (returns 402 without payment) |
| `/api/swap/quote` | GET | Get Mento swap quote |
| `/api/swap/execute` | POST | Execute Mento swap |
| `/api/market-data/*` | GET | Market data (mento, forex, crypto, commodities) |

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
NEXT_PUBLIC_AGENT_ID=4           # ERC-8004 agent ID
ANTHROPIC_API_KEY=               # Claude API key
AGENT_PRIVATE_KEY=               # Agent wallet private key (for auto-execution)
AGENT_WALLET_ADDRESS=            # Wallet address for x402 payments
CRON_SECRET=                     # Vercel cron authentication
```

## Why This Matters

Stablecoin FX on Mento is underserved. EUR/USD trades at $7.5T daily, but Mento's cUSD/cEUR pair has minimal automated arbitrage coverage. When Mento oracle rates drift from real forex, spreads open up that can be captured by an autonomous agent.

CeloFX is the first autonomous agent that monitors Mento spreads against real forex rates and executes when profitable — no human in the loop, fully verifiable on Celoscan.

| | Manual FX | Hummingbot | CeloFX |
|---|---|---|---|
| Mento integration | No | CLI only | Full (on-chain reads + swaps) |
| AI analysis | No | No | Claude with 7 tools |
| Cross-market signals | No | No | Forex + Crypto + Commodities |
| On-chain reputation | No | No | ERC-8004 |
| Micropayments | No | No | x402 ($0.01/signal) |
| Autonomous execution | No | Partial | Full (cron + wallet + auto-swap) |
