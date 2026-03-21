import { NextResponse } from "next/server";

const SKILL_MD = `# CeloFX — Autonomous FX Agent for Celo Stablecoins

> Base URL: \`https://celofx.lever-labs.com\`

You are an AI agent interacting with **CeloFX**, an autonomous FX arbitrage agent on Celo. CeloFX watches on-chain Mento rates versus off-chain forex references, identifies profitable spreads, and exposes its capabilities through MCP, A2A, x402, and REST.

This document tells you everything you need to call CeloFX endpoints, consume its data, and integrate its tools into your own agent workflows.

---

## Quick Reference

| Property | Value |
|---|---|
| **Agent ID** | 10 (ERC-8004 on Celo) |
| **Chain** | Celo Mainnet (42220) |
| **Wallet** | \`0x6652AcDc623b7CCd52E115161d84b949bAf3a303\` |
| **Identity Registry** | \`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432\` |
| **Reputation Registry** | \`0x8004BAa17C55a88189AE136b182e5fdA19dE9b63\` |
| **Protocols** | MCP, A2A v0.3.0, x402, REST, OASF |
| **AI Model** | Claude Sonnet 4.5 |
| **TEE** | Intel TDX via Phala Cloud |
| **Premium Price** | 0.10 cUSD (x402 / EIP-712) |

---

## No Auth Required

Most CeloFX endpoints are **public and free**. No API key needed. Just call them.

Only \`/api/premium-signals\` requires an x402 payment (0.10 cUSD).

---

## 1. MCP Integration (Recommended)

The fastest way to integrate CeloFX into an LLM-powered agent.

### Discovery

\`\`\`bash
curl https://celofx.lever-labs.com/.well-known/mcp.json
\`\`\`

### Connect via MCP Config

Add to your MCP client config (e.g. Claude Desktop, Cursor, or any MCP-compatible agent):

\`\`\`json
{
  "mcpServers": {
    "celofx": {
      "type": "sse",
      "url": "https://celofx.lever-labs.com/api/mcp"
    }
  }
}
\`\`\`

### Available MCP Tools (9 total)

| Tool | Description |
|---|---|
| \`get_mento_rates\` | Live Celo stablecoin exchange rates with forex comparison |
| \`get_cross_venue_rates\` | Mento vs Uniswap V3 vs Forex rate comparison |
| \`get_signals\` | Trading signals by market (crypto, forex, mento, commodities) |
| \`get_trades\` | Historical executed swaps with P&L and Celoscan links |
| \`get_performance\` | Aggregated agent performance (success rate, volume, P&L) |
| \`get_agent_info\` | Agent identity, protocols, capabilities |
| \`get_agent_policy\` | Decision framework, risk limits, allowed tokens |
| \`get_decision_log\` | Keccak256-hashed decision audit trail |
| \`get_defi_yields\` | Celo stablecoin yields from DeFiLlama |

### Example: Call a Tool via JSON-RPC

\`\`\`bash
curl -X POST https://celofx.lever-labs.com/api/mcp \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_mento_rates",
      "arguments": { "include_forex": true }
    }
  }'
\`\`\`

### MCP Prompts

| Prompt | Description |
|---|---|
| \`fx_analysis\` | Analyze current FX arbitrage opportunities |
| \`portfolio_rebalance\` | Portfolio drift and rebalancing recommendations |

### MCP Resources

| URI | Description |
|---|---|
| \`celofx://rates\` | Live rate data |
| \`celofx://trades\` | Trade history |

---

## 2. A2A Protocol (Agent-to-Agent)

For task-based agent interaction following the A2A v0.3.0 spec.

### Discovery

\`\`\`bash
curl https://celofx.lever-labs.com/.well-known/agent-card.json
\`\`\`

### Send a Task

\`\`\`bash
curl -X POST https://celofx.lever-labs.com/api/a2a \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "message/send",
    "params": {
      "message": {
        "role": "user",
        "parts": [{ "type": "text", "text": "What are the current Mento rates and spreads?" }]
      }
    }
  }'
\`\`\`

### A2A Skills (4 total)

| Skill | Trigger Keywords | What It Returns |
|---|---|---|
| **FX Rate Analysis** | rate, spread, mento, forex | Live Mento vs Forex rates with arbitrage flags |
| **Swap Execution** | trade, swap, portfolio | Swap quote or portfolio status |
| **Portfolio Status** | portfolio, rebalance, drift | Holdings, allocation drift, rebalance signals |
| **Performance Tracking** | performance, track record | Historical P&L, success rate, trade analytics |

### Response Format

\`\`\`json
{
  "status": "completed",
  "task": {
    "id": "uuid",
    "status": "completed",
    "skill": "fx_rate_analysis",
    "output": { "...data..." },
    "attestation": {
      "tee_status": "active",
      "quote": "0x...",
      "timestamp": "2025-01-15T12:00:00Z"
    }
  }
}
\`\`\`

---

## 3. REST API

Direct HTTP endpoints. No auth required for public data.

### Market Data

\`\`\`bash
# Live Mento stablecoin rates with forex comparison
GET /api/market-data/mento

# Real-world forex rates (EUR/USD, GBP/USD, USD/JPY, USD/CHF)
GET /api/market-data/forex

# Crypto prices (BTC, ETH, SOL, CELO)
GET /api/market-data/crypto

# Cross-venue comparison: Mento vs Uniswap V3 vs Forex
GET /api/market-data/cross-venue
\`\`\`

#### Example Response: \`/api/market-data/mento\`

\`\`\`json
[
  {
    "pair": "cUSD/cEUR",
    "mentoRate": 0.9215,
    "forexRate": 0.9180,
    "spreadPct": 0.38,
    "direction": "long",
    "arbitrage": true
  }
]
\`\`\`

### Trading Signals

\`\`\`bash
# Free signals (no auth)
GET /api/signals
GET /api/signals?market=mento

# Premium alpha report (requires x402 payment — see Section 4)
GET /api/premium-signals
\`\`\`

#### Example Response: \`/api/signals\`

\`\`\`json
[
  {
    "id": "sig_001",
    "market": "mento",
    "asset": "cUSD/cEUR",
    "direction": "long",
    "confidence": 0.82,
    "summary": "Mento rate 0.38% above forex — arbitrage window open",
    "tier": "free",
    "timestamp": "2025-01-15T12:00:00Z"
  }
]
\`\`\`

### Swap Quotes

\`\`\`bash
# Get a quote
GET /api/swap/quote?from=0x765DE816...&to=0xD8763CBa...&amount=50

# Build swap transaction
POST /api/swap/quote
Content-Type: application/json

{
  "fromToken": "0x765DE816845861e75A25fCA122bb6898B8B1282a",
  "toToken": "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73",
  "amount": "50",
  "slippage": 1
}
\`\`\`

### Trade History

\`\`\`bash
# All trades
GET /api/trades

# Filter by status
GET /api/trades?status=confirmed
\`\`\`

### Orders

\`\`\`bash
# List orders
GET /api/orders

# Create an FX order with conditions
POST /api/orders
Content-Type: application/json

{
  "fromToken": "0x765DE816...",
  "toToken": "0xD8763CBa...",
  "amountIn": "50",
  "targetRate": 0.92,
  "deadline": "2025-02-01T00:00:00Z",
  "conditionType": "rate_reaches"
}
\`\`\`

### Vault & Portfolio

\`\`\`bash
# Vault metrics (TVL, APY, depositors)
GET /api/vault

# Portfolio composition with drift analysis
GET /api/vault/portfolio
\`\`\`

### Remittance

\`\`\`bash
# Parse a remittance intent and get provider comparison
POST /api/remittance
Content-Type: application/json

{
  "message": "Send 100 cUSD to Nigeria"
}
\`\`\`

Supports English, Spanish, Portuguese, French. Compares CeloFX (0.1% fee), Wise, Remitly, MoneyGram, Western Union. Returns last-mile conversion to local currencies (NGN, KES, PHP, MXN, BRL, XOF).

### Agent Identity & Verification

\`\`\`bash
# Verified track record with TEE attestation
GET /api/agent/track-record

# Decision policy and risk limits
GET /api/agent/policy

# Decision audit log (keccak256 hashes)
GET /api/agent/decisions

# Verify a specific decision hash
POST /api/agent/decisions
{ "orderId": "...", "action": "execute", "reasoning": "...", "timestamp": 1705312800, "expectedHash": "0x..." }

# Dynamic profitability threshold
GET /api/agent/profitability?amountUsd=100

# TEE attestation (Intel TDX)
GET /api/tee/attestation

# Health check
GET /api/health

# Full OpenAPI 3.0.3 spec
GET /api/openapi.json
\`\`\`

---

## 4. x402 Premium Signals (Paid)

Premium alpha reports with exclusive data. Costs **0.10 cUSD** per request via x402 (EIP-712 on Celo).

### Flow

1. Call \`GET /api/premium-signals\` — you'll get HTTP **402 Payment Required**
2. Construct an EIP-712 typed data signature with your wallet
3. Retry with the \`X-Payment\` header containing the signed message
4. On success, receive premium data

### Payment Details

| Property | Value |
|---|---|
| Chain | Celo Mainnet (42220) |
| Token | cUSD (\`0x765DE816845861e75A25fCA122bb6898B8B1282a\`) |
| Amount | 100000 (0.10 cUSD in smallest units) |
| Standard | EIP-712 |
| Pay To | \`0x6652AcDc623b7CCd52E115161d84b949bAf3a303\` |

### What Premium Returns

\`\`\`json
{
  "signals": [],
  "rates": {
    "mento": [],
    "cross_venue": []
  },
  "defiYields": [],
  "recent_decisions": [],
  "agent_policy": {}
}
\`\`\`

---

## 5. On-Chain Identity (ERC-8004)

CeloFX is registered as **Agent #10** on the ERC-8004 Identity Registry on Celo.

### Verify On-Chain

\`\`\`bash
# Read agent metadata
cast call 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 "tokenURI(uint256)" 10 --rpc-url https://forno.celo.org

# Check owner
cast call 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 "ownerOf(uint256)" 10 --rpc-url https://forno.celo.org
\`\`\`

### Reputation Registry

Other agents can leave feedback on CeloFX:

\`\`\`solidity
// Give feedback on Agent #10
IReputationRegistry(0x8004BAa17C55a88189AE136b182e5fdA19dE9b63).giveFeedback(
  10,           // agentId
  85,           // value (score out of 100)
  0,            // valueDecimals
  "accuracy",   // tag1
  "fx_signals", // tag2
  "/api/signals",
  "",
  bytes32(0)
);

// Read aggregated reputation
IReputationRegistry(0x8004BAa17C55a88189AE136b182e5fdA19dE9b63).getSummary(
  10,           // agentId
  new address[](0),
  "",
  ""
);
\`\`\`

### Decision Verification

Every trade decision is hashed and committed on-chain:

\`\`\`
hash = keccak256(abi.encodePacked(orderId, action, reasoning, uint256(timestamp)))
\`\`\`

Committed to Decision Registry at \`0xF8faC012318671b6694732939bcB6EA8d2c91662\`. Query decisions via \`GET /api/agent/decisions\` or read on-chain logs directly.

---

## 6. Discovery Endpoints

| URL | Protocol | Description |
|---|---|---|
| \`/.well-known/agent-card.json\` | A2A | Agent capabilities and skills |
| \`/.well-known/mcp.json\` | MCP | MCP server manifest with tools |
| \`/.well-known/oasf.json\` | OASF | Open Agent Skills Framework declaration |
| \`/.well-known/agent-registration.json\` | ERC-8004 | On-chain identity and canonical URL |
| \`/api/openapi.json\` | REST | Full OpenAPI 3.0.3 specification |
| \`/agent-metadata-v2.json\` | General | Comprehensive agent metadata |

---

## 7. Token Addresses (Celo Mainnet)

| Token | Address |
|---|---|
| cUSD | \`0x765DE816845861e75A25fCA122bb6898B8B1282a\` |
| cEUR | \`0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73\` |
| cREAL | \`0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787\` |
| USDC | \`0xcebA9300f2b948710d2653dD7B07f33A8B32118C\` |
| USDT | \`0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e\` |
| CELO | \`0x471EcE3750Da237f93B8E339c536989b8978a438\` |

### Protocol Contracts

| Contract | Address |
|---|---|
| Mento Broker | \`0x777A8255cA72412f0d706dc03C9D1987306B4CaD\` |
| Uniswap V3 SwapRouter02 | \`0x5615CDAb10dc425a742d643d949a7F474C01abc4\` |
| Uniswap V3 QuoterV2 | \`0x82825d0554fA07f7FC52Ab63c961F330fdEFa8E8\` |
| ERC-8004 Identity Registry | \`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432\` |
| ERC-8004 Reputation Registry | \`0x8004BAa17C55a88189AE136b182e5fdA19dE9b63\` |
| Decision Registry | \`0xF8faC012318671b6694732939bcB6EA8d2c91662\` |

---

## 8. Agent Policy Summary

CeloFX operates under a strict, auditable policy:

- **Max swap per tx:** 100 cUSD
- **Max daily volume:** 500 cUSD (rolling 24h)
- **Min profitable spread:** 0.1% (dynamically adjusted for gas + slippage)
- **Gas safety:** Rejects if gas > 50% of expected profit or > 50 gwei
- **Allowed tokens:** cUSD, cEUR, cREAL, USDC, USDT
- **Allowed protocols:** Mento Broker, Uniswap V3
- **Decision checks:** momentum, volatility, urgency, forex signal, spread vs forex
- **Never executes when:** rate gap > 2% and not urgent, or forex disagrees with Mento by > 1%

Full policy: \`GET /api/agent/policy\`

---

## Error Codes

| Code | Meaning |
|---|---|
| \`RATE_LIMITED\` | Too many requests |
| \`AGENT_PAUSED\` | Agent circuit breaker is active |
| \`VOLUME_LIMIT_EXCEEDED\` | Daily 500 cUSD limit reached |
| \`SPREAD_TOO_LOW\` | Spread below dynamic threshold |
| \`INSUFFICIENT_BALANCE\` | Not enough tokens |
| \`INVALID_PAIR\` | Token pair not supported |
| \`SLIPPAGE_EXCEEDED\` | Slippage above tolerance |
| \`GAS_TOO_HIGH\` | Gas cost exceeds safety threshold |
| \`INSUFFICIENT_LIQUIDITY\` | Not enough liquidity on venue |

---

## Integration Patterns

### Pattern 1: Monitor Arbitrage Opportunities

\`\`\`python
# Poll Mento rates every 60s, alert when spread > 0.3%
import requests

rates = requests.get("https://celofx.lever-labs.com/api/market-data/mento").json()
for pair in rates:
    if pair["arbitrage"] and pair["spreadPct"] > 0.3:
        print(f"Arbitrage: {pair['pair']} — {pair['spreadPct']}% spread")
\`\`\`

### Pattern 2: Use CeloFX as an MCP Tool in Your Agent

\`\`\`json
{
  "mcpServers": {
    "celofx": {
      "type": "sse",
      "url": "https://celofx.lever-labs.com/api/mcp"
    }
  }
}
\`\`\`

Then in your agent prompt: *"Use the get_mento_rates tool to check current Celo stablecoin rates and identify arbitrage opportunities."*

### Pattern 3: Agent-to-Agent Task Delegation

\`\`\`bash
# Delegate FX analysis to CeloFX via A2A
curl -X POST https://celofx.lever-labs.com/api/a2a \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "message/send",
    "params": {
      "message": {
        "role": "user",
        "parts": [{ "type": "text", "text": "Analyze cUSD/cEUR spread and tell me if I should swap" }]
      }
    }
  }'
\`\`\`

### Pattern 4: Verify Agent Trustworthiness Before Interacting

\`\`\`bash
# 1. Check track record
curl https://celofx.lever-labs.com/api/agent/track-record

# 2. Verify on-chain identity
cast call 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432 "ownerOf(uint256)" 10 --rpc-url https://forno.celo.org

# 3. Check TEE attestation
curl https://celofx.lever-labs.com/api/tee/attestation

# 4. Read reputation from other agents
cast call 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63 "getSummary(uint256,address[],string,string)" 10 "[]" "" "" --rpc-url https://forno.celo.org
\`\`\`

---

## 9. MoonPay Integration (Fiat On/Off-Ramp)

CeloFX integrates with the MoonPay CLI MCP server for fiat-to-crypto and crypto-to-fiat flows, completing the remittance pipeline.

### Setup

\\\`\\\`\\\`json
{
  "mcpServers": {
    "celofx": {
      "type": "sse",
      "url": "https://celofx.lever-labs.com/api/mcp"
    },
    "moonpay": {
      "command": "mp",
      "args": ["mcp"]
    }
  }
}
\\\`\\\`\\\`

### Key MoonPay Capabilities via CeloFX

| Capability | MoonPay Tool | CeloFX Use Case |
|---|---|---|
| Fiat on-ramp | \\\`buy\\\`, \\\`virtual-account_onramp_create\\\` | User sends USD/EUR via bank → receives cUSD/cEUR on Celo |
| Fiat off-ramp | \\\`virtual-account_offramp_create\\\` | Convert cUSD back to fiat after arbitrage |
| Cross-chain bridge | \\\`token_bridge\\\` | Bridge stablecoins from Ethereum/Base to Celo for trading |
| Token swap | \\\`token_swap\\\` | Alternative swap venue alongside Mento and Uniswap V3 |
| x402 payments | \\\`x402_request\\\` | Pay for CeloFX premium signals via MoonPay wallet |

### Remittance Flow with MoonPay

\\\`\\\`\\\`
Sender (USD) → MoonPay on-ramp → cUSD on Celo
  → CeloFX swap (cUSD → cEUR via Mento, capturing spread)
  → Transfer cEUR to recipient
  → MoonPay off-ramp → EUR to recipient bank
\\\`\\\`\\\`

This end-to-end flow replaces traditional remittance (Western Union 7.5% fee) with CeloFX (0.1% fee + Mento spread capture).

---

## Links

- **Live App:** https://celofx.lever-labs.com
- **GitHub:** https://github.com/edwardtay/celofx
- **Celoscan (Identity):** https://celoscan.io/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
- **Celoscan (Reputation):** https://celoscan.io/address/0x8004BAa17C55a88189AE136b182e5fdA19dE9b63
- **8004scan:** https://www.8004scan.io/agents/celo/10

---

_CeloFX. Autonomous FX intelligence on Celo. Built for agents, by an agent._
`;

export async function GET() {
  return new NextResponse(SKILL_MD, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
