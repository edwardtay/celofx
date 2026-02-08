# $AAA — Alpha Acceleration Agent

Cross-market alpha analyst that scans crypto, stocks, forex, and commodities to surface high-conviction trading signals. Registered on-chain via ERC-8004, monetized via x402 micropayments, built on Celo.

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
          │ Claude AI  │          │ Celo Alfajores │
          │ Agent Loop │          │   (on-chain)   │
          └────────────┘          └────────────────┘
```

### Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind v4, shadcn/ui, wagmi, viem, RainbowKit
- **AI Agent**: Anthropic Claude with tool-use (5 tools: fetch crypto/stocks/forex/commodities, generate signal)
- **Payments**: x402 protocol — HTTP 402 with `X-PAYMENT-REQUIRED` header, `@x402/core` for encoding, `@x402/fetch` for client
- **Identity**: ERC-8004 Identity Registry on Celo Alfajores (`0x8004A818BFB912233c491871b3d84c89A494BD9e`)
- **Reputation**: ERC-8004 Reputation Registry on Celo Alfajores (`0x8004B663056A597Dffe9eCcC1965A193B7388713`)
- **Chain**: Celo Alfajores testnet (cUSD for payments)

## How x402 Works Here

```
User clicks "Unlock Premium"
  → Client fetches GET /api/premium-signals
  → Server returns HTTP 402 + X-PAYMENT-REQUIRED header
  → @x402/fetch reads requirements (scheme: exact, $0.01 cUSD, eip155:44787)
  → Wallet signs EIP-712 payment authorization (no gas)
  → Client retries with X-PAYMENT header
  → Server decodes + verifies → returns premium signals
```

The premium endpoint uses `@x402/core/http` for standards-compliant header encoding/decoding. Payment requirements include the cUSD asset address on Celo Alfajores.

## How ERC-8004 Works Here

**Identity**: Agent is registered on the ERC-8004 Identity Registry with a metadata URI following the `registration-v1` schema. The frontend reads `tokenURI(agentId)` and `ownerOf(agentId)` to display the agent's on-chain profile.

**Reputation**: Users submit feedback via `giveFeedback(agentId, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash)`. The value uses a 0-100 scale (mapped from 1-5 stars). Aggregate scores are read via `getSummary()` and individual feedback via `readAllFeedback()`.

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard with market overview, agent status, top signals |
| `/signals` | Full signal feed with market filters (Crypto/Stocks/Forex/Commodities) |
| `/premium` | x402-gated premium signals with entry/exit prices and stop losses |
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
NEXT_PUBLIC_AGENT_ID=1           # ERC-8004 agent ID
ANTHROPIC_API_KEY=               # Claude API key (for /api/agent/analyze)
AGENT_WALLET_ADDRESS=            # Wallet address for x402 payments
FINNHUB_API_KEY=                 # Optional: Finnhub for stock data
```

## Why This Matters

AIXBT proved 300K people want AI-generated alpha. But it's crypto-only, has no verifiable track record, and costs $1,400 in tokens to access premium features.

$AAA extends this to all financial markets, proves its track record on-chain via ERC-8004, and lets anyone pay a penny per signal via x402 on Celo.

Cross-market coverage + verifiable reputation + micropayment access — three things no existing competitor offers together.
