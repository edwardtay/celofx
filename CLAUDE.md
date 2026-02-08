# Starter EVM Template

## What This Is
Reusable scaffold for EVM hackathon projects. Clone this, don't modify in place.

## Quick Start
```bash
cp -r starter-evm/ ../new-project-name/
cd ../new-project-name/
```
Then:
1. Edit `frontend/src/config/site.ts` — project name/description
2. Edit `frontend/src/config/wagmi.ts` — target chains
3. Copy `.env.example` → `.env.local` — add WalletConnect project ID
4. `cd frontend && pnpm install && pnpm dev`
5. `cd contracts && forge build`

## Structure
- `frontend/` — Next.js 16 + wagmi + viem + RainbowKit
- `contracts/` — Foundry, Solidity 0.8.26, EVM Cancun
- `agent/` — Anthropic SDK tool-use agent scaffold

## Chains
Default: Ethereum mainnet, Base, Sepolia. Change in wagmi.ts.

## Contract Workflow
```bash
cd contracts
forge build
forge test
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
```

## When Creating a New Project From This Template
- Always run `pnpm install` in frontend/ after cloning
- Always create .env.local before running dev server
- Update foundry.toml rpc_endpoints for target chain
