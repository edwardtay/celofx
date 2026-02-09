# $AAA — Alpha Acceleration Agent

Cross-market alpha analyst that scans crypto, stocks, forex, and commodities to surface high-conviction trading signals. Registered on-chain via ERC-8004, monetized via x402 micropayments, built on Celo.

**Live**: [aaa-agent-steel.vercel.app](https://aaa-agent-steel.vercel.app)

---

## For Hackathon Judges

### Demo Flow (2 minutes)

1. **Dashboard** → See top trading signals (sorted by confidence) + live market prices across 4 markets
2. **Click "Scan Markets"** → Watch Agent #4 fetch live data from CoinGecko, Finnhub, Frankfurter, then generate AI signals (~30s)
3. **Click any signal card** → Full detail modal with reasoning, entry/exit prices, confidence score
4. **Navigate to Premium** → See x402 paywall with blurred premium signals
5. **Unlock Premium** ([demo link](https://aaa-agent-steel.vercel.app/premium?demo=true)) → Watch step-by-step payment: real HTTP 402 response → EIP-712 sign → verify on Celo
6. **Navigate to Agent** → See on-chain identity (Agent #4) + reputation (5 feedbacks from 3 wallets) + raw metadata JSON
7. **Submit feedback** → Connect wallet on Celo, rate the agent 1-5 stars, see tx confirm on Celoscan

### Key Innovations

- **Cross-market coverage** — Not just crypto. Scans stocks, forex, commodities. Real-world use case.
- **Both ERC-8004 registries** — Identity (agent profile on-chain) AND Reputation (user feedback on-chain). Not just one.
- **Real x402 implementation** — HTTP 402 headers, `@x402/core` encoding, `@x402/fetch` client, EIP-712 signatures. Not a mock.
- **Real AI agent** — Claude with 5 tools in an agentic loop. Fetches live data, generates structured signals.
- **Celo mainnet** — Not testnet. Real cUSD payments, real on-chain data.

### Verify On-Chain

| What | Link |
|------|------|
| Agent #4 Registration | [celoscan.io/tx/0xea64b5d...](https://celoscan.io/tx/0xea64b5d790028208b285bb05a00cb506b44f7fa6d10099cff6671bd42e9a3ab6) |
| Feedback: 90/100 | [celoscan.io/tx/0x238e1f...](https://celoscan.io/tx/0x238e1f606bcdab5789ef4f7dc5c69147e2ff5779bfd2a69605de3793636be70c) |
| Feedback: 80/100 | [celoscan.io/tx/0xfb08a3...](https://celoscan.io/tx/0xfb08a317148df32a911813d400883dd7f5a53ce20bdb33a7745f8050ef9d3199) |
| Feedback: 95/100 | [celoscan.io/tx/0x40ec63...](https://celoscan.io/tx/0x40ec63fe091e54c1181304d19c0348721092716b4dd0088e30f7bee0d9fa493c) |
| Feedback: 75/100 | [celoscan.io/tx/0x84bc50...](https://celoscan.io/tx/0x84bc5016754b09645716487392667d2331c894fc48512eda39a901fdcad424ad) |
| Identity Registry | [celoscan.io/address/0x8004A1...](https://celoscan.io/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432) |
| Reputation Registry | [celoscan.io/address/0x8004BA...](https://celoscan.io/address/0x8004BAa17C55a88189AE136b182e5fdA19dE9b63) |

### Key Source Files

| File | What It Does |
|------|-------------|
| [`agent-tools.ts`](frontend/src/lib/agent-tools.ts) | Claude agent system prompt + 5 tool definitions |
| [`analyze/route.ts`](frontend/src/app/api/agent/analyze/route.ts) | Agentic loop: fetch data → generate signals |
| [`premium-gate.tsx`](frontend/src/components/premium/premium-gate.tsx) | x402 payment flow with step-by-step visualization |
| [`premium-signals/route.ts`](frontend/src/app/api/premium-signals/route.ts) | HTTP 402 endpoint with `@x402/core` headers |
| [`contracts.ts`](frontend/src/config/contracts.ts) | ERC-8004 ABIs + registry addresses |
| [`reputation-form.tsx`](frontend/src/components/agent/reputation-form.tsx) | On-chain feedback via `giveFeedback()` |
| [`reputation-display.tsx`](frontend/src/components/agent/reputation-display.tsx) | `getSummary()` + `readAllFeedback()` from ERC-8004 |

---

## What It Does

$AAA is an AI-powered trading signal agent that:

- **Scans 4 markets** — Crypto (CoinGecko), stocks (Finnhub), forex (Frankfurter), and commodities. Not just another crypto bot.
- **Generates actionable signals** — Direction, confidence score, entry/exit prices, stop losses, and reasoning via Claude AI with tool-use.
- **Verifiable identity** — Registered on Celo via ERC-8004 Identity Registry. Agent profile, capabilities, and metadata are on-chain.
- **Verifiable reputation** — Users leave on-chain feedback via ERC-8004 Reputation Registry. Signal quality is provable, not claimed.
- **Pay-per-signal** — Premium signals gated behind x402 micropayments ($0.01 in cUSD on Celo). No subscriptions, no token gates.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Next.js Frontend                  │
│  Dashboard │ Signals │ Premium (x402) │ Agent (8004) │
└─────┬──────────┬────────────┬──────────────┬────────┘
      │          │            │              │
      ▼          ▼            ▼              ▼
┌──────────┐ ┌────────┐ ┌─────────┐ ┌──────────────┐
│ Market   │ │ Signal │ │  x402   │ │   ERC-8004   │
│ Data APIs│ │ Store  │ │ Payment │ │   Identity   │
│ (4 srcs) │ │        │ │ Gate    │ │ + Reputation │
└──────────┘ └───┬────┘ └─────────┘ └──────────────┘
                 │                         │
                 ▼                         ▼
          ┌────────────┐          ┌────────────────┐
          │ Claude AI  │          │ Celo Mainnet   │
          │ Agent Loop │          │   (on-chain)   │
          └────────────┘          └────────────────┘
```

### Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind v4, shadcn/ui, wagmi, viem, RainbowKit
- **AI Agent**: Anthropic Claude with tool-use (5 tools: fetch crypto/stocks/forex/commodities, generate signal)
- **Payments**: x402 protocol — HTTP 402 with `X-PAYMENT-REQUIRED` header, `@x402/core` for encoding, `@x402/fetch` for client
- **Identity**: ERC-8004 Identity Registry on Celo (`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`)
- **Reputation**: ERC-8004 Reputation Registry on Celo (`0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`)
- **Chain**: Celo mainnet (cUSD for payments)

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

The premium endpoint uses `@x402/core/http` for standards-compliant header encoding/decoding. Payment requirements include the cUSD asset address on Celo.

## How ERC-8004 Works Here

**Identity**: Agent is registered on the ERC-8004 Identity Registry with a metadata URI following the `registration-v1` schema. The frontend reads `tokenURI(agentId)` and `ownerOf(agentId)` to display the agent's on-chain profile.

- **Agent ID**: 4
- **Registration Tx**: [celoscan.io/tx/0xea64b5d...](https://celoscan.io/tx/0xea64b5d790028208b285bb05a00cb506b44f7fa6d10099cff6671bd42e9a3ab6)
- **Metadata URI**: [agent-metadata.json](https://aaa-agent-steel.vercel.app/agent-metadata.json)

**Reputation**: Users submit feedback via `giveFeedback(agentId, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash)`. The value uses a 0-100 scale (mapped from 1-5 stars). Aggregate scores are read via `getSummary()` and individual feedback via `readAllFeedback()`.

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard with market overview, agent status, performance metrics, top signals |
| `/signals` | Full signal feed with market filters (Crypto/Stocks/Forex/Commodities) |
| `/premium` | x402-gated premium signals with entry/exit prices and stop losses |
| `/premium?demo=true` | Demo mode — simulates x402 payment flow without wallet |
| `/agent` | ERC-8004 agent profile, reputation score, feedback form |

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/signals` | GET | Free-tier signals (market filter via `?market=crypto`) |
| `/api/premium-signals` | GET | x402-protected premium signals (returns 402 without payment) |
| `/api/agent/analyze` | POST | Triggers Claude AI analysis cycle, generates new signals |
| `/api/market-data/crypto` | GET | CoinGecko price data |
| `/api/market-data/forex` | GET | Frankfurter exchange rates |
| `/api/market-data/stocks` | GET | Finnhub stock quotes |
| `/api/market-data/commodities` | GET | Commodity prices |

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
ANTHROPIC_API_KEY=               # Claude API key (for /api/agent/analyze)
AGENT_WALLET_ADDRESS=            # Wallet address for x402 payments
FINNHUB_API_KEY=                 # Optional: Finnhub for stock data
```

## Why This Matters

AIXBT proved 300K people want AI-generated alpha. But it's crypto-only, has no verifiable track record, and costs $1,400 in tokens to access premium features.

$AAA extends this to all financial markets, proves its track record on-chain via ERC-8004, and lets anyone pay a penny per signal via x402 on Celo.

| | AIXBT | $AAA |
|---|---|---|
| Markets | Crypto only | Crypto + Stocks + Forex + Commodities |
| Access cost | $1,400 token gate | $0.01 per signal |
| Reputation | Self-reported | ERC-8004 on-chain (immutable) |
| Payment | Hold tokens | x402 micropayments (cUSD) |
| Verification | Trust us | Check Celoscan |

Cross-market coverage + verifiable reputation + micropayment access — three things no existing competitor offers together.
