import { NextResponse } from "next/server";
import { getAttestation } from "@/lib/tee";

export async function GET() {
  const tee = await getAttestation();
  return NextResponse.json({
    name: "CeloFX",
    description:
      "Autonomous FX arbitrage agent on Celo. Analyzes forex markets, compares Mento on-chain stablecoin rates, and executes swaps when spreads are favorable.",
    url: "https://celofx.vercel.app/api/a2a",
    protocolVersion: "0.3.0",
    version: "1.0.0",
    provider: {
      organization: "CeloFX",
      url: "https://celofx.vercel.app",
    },
    iconUrl: "https://celofx.vercel.app/celofx-logo.png",
    capabilities: {
      streaming: false,
      pushNotifications: false,
      stateTransitionHistory: false,
    },
    defaultInputModes: ["text/plain", "application/json"],
    defaultOutputModes: ["text/plain", "application/json"],
    authentication: {
      schemes: ["none"],
      credentials: null,
    },
    x402: {
      supported: true,
      endpoint: "https://celofx.vercel.app/api/premium-signals",
      price: "$0.01",
      currency: "cUSD",
      chain: "celo",
      standard: "EIP-712",
    },
    tee: {
      status: tee.status,
      verified: tee.verified,
      infrastructure: tee.verified ? "Intel TDX (Phala Cloud)" : "Vercel",
      attestationEndpoint: "https://celofx.vercel.app/api/tee/attestation",
    },
    skills: [
      {
        id: "fx_rate_analysis",
        name: "FX Rate Analysis",
        description:
          "Compares live Mento Broker on-chain stablecoin rates with real forex rates (EUR/USD, USD/BRL) to identify arbitrage spreads. Returns spread percentage and whether it exceeds the 0.3% execution threshold.",
        tags: ["forex", "arbitrage", "celo", "mento", "stablecoin", "spread"],
        examples: [
          "What are the current Mento spreads?",
          "Compare cEUR/cUSD on-chain rate vs EUR/USD forex rate",
          "Is there an arbitrage opportunity on Mento right now?",
        ],
        inputModes: ["text/plain"],
        outputModes: ["application/json"],
      },
      {
        id: "execute_swap",
        name: "Execute Mento Swap",
        description:
          "Executes a Mento Broker stablecoin swap on Celo mainnet using CIP-64 fee abstraction (gas paid in cUSD). Requires spread > 0.3% threshold and Bearer auth.",
        tags: ["swap", "execution", "mento", "celo", "defi", "fee-abstraction"],
        examples: [
          "Swap 2 cUSD to cEUR on Mento",
          "Execute arbitrage on cUSD/cREAL pair",
        ],
        inputModes: ["application/json"],
        outputModes: ["application/json"],
      },
      {
        id: "portfolio_status",
        name: "Portfolio Status",
        description:
          "Returns agent execution wallet balances, recent on-chain trades with Celoscan links, and trade statistics",
        tags: ["portfolio", "status", "balance", "trades", "celoscan"],
        examples: [
          "Show agent portfolio",
          "What trades were executed today?",
          "Show recent swaps",
        ],
        inputModes: ["text/plain"],
        outputModes: ["application/json"],
      },
      {
        id: "performance_tracking",
        name: "Performance Tracking",
        description:
          "Returns the agent's verified track record: total volume, cumulative P&L, success rate, pairs traded. All trades have on-chain proof verifiable on Celoscan.",
        tags: ["performance", "pnl", "track-record", "verification", "celoscan"],
        examples: [
          "What is the agent's track record?",
          "Show cumulative P&L",
          "How many trades has the agent executed?",
        ],
        inputModes: ["text/plain"],
        outputModes: ["application/json"],
      },
    ],
  });
}
