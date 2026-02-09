# CeloFX

Autonomous FX agent on Celo. Analyzes forex markets, compares with Mento on-chain stablecoin rates, and recommends/executes swaps when spreads are favorable.

## Architecture

```
Agent Flow:
  Fetch Mento rates (cUSD/cEUR, cUSD/cREAL) → Compare vs real forex rates
  → Identify spread opportunities → Generate swap signals
  → User approves → Execute via Mento Broker on Celo

Tech Stack:
  Frontend: Next.js 16 + React 19 + Tailwind v4 + shadcn/ui + wagmi + viem + RainbowKit
  Agent: Claude (Anthropic SDK) with tool-use loop
  Chain: Celo mainnet (EVM L2)
  Payments: x402 (Thirdweb) for premium signal micropayments
  Identity: ERC-8004 Identity + Reputation Registry
  FX: Mento Protocol (Broker contract for stablecoin swaps)
```

## Key Addresses (Celo Mainnet)

- ERC-8004 Identity Registry: `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- ERC-8004 Reputation Registry: `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`
- Mento Broker: `0x777A8255cA72412f0d706dc03C9D1987306B4CaD`
- cUSD: `0x765DE816845861e75A25fCA122bb6898B8B1282a`
- cEUR: `0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73`
- cREAL: `0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787`
- CELO: `0x471EcE3750Da237f93B8E339c536989b8978a438`

## Agent Tools

- `fetch_mento_rates` — Mento stablecoin exchange rates vs real forex (the core)
- `fetch_forex` — Real-world forex rates (EUR/USD, GBP/USD, USD/JPY, USD/CHF)
- `fetch_crypto` — Crypto prices (BTC, ETH, SOL, CELO)
- `fetch_commodities` — Commodity prices (Gold, Oil, Silver, Gas)
- `fetch_stocks` — Stock prices (AAPL, NVDA, TSLA, MSFT)
- `generate_fx_action` — Mento swap recommendation (from/to token, rates, spread)
- `generate_signal` — General market signal (crypto, stocks, forex, commodities)

## Commands

```bash
cd frontend && pnpm install && pnpm dev
```

## Hackathon

- **Hackathon**: Build Agents for the Real World (Celo)
- **Dates**: Feb 6-15, 2026
- **Prizes**: $4K 1st + $1K 2nd
- **Submission**: Tweet + Karma + ERC-8004 agentId + SelfClaw verification
- **Agent ID**: #4 on ERC-8004 Identity Registry
