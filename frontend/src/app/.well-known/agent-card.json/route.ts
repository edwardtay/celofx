import { NextResponse } from "next/server";

export async function GET() {
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
    skills: [
      {
        id: "fx_rate_analysis",
        name: "FX Rate Analysis",
        description:
          "Analyzes current forex rates vs Mento on-chain stablecoin rates to identify arbitrage opportunities",
        tags: ["forex", "arbitrage", "celo", "mento", "stablecoin"],
        examples: [
          "What are the current Mento spreads?",
          "Compare cEUR/cUSD on-chain rate vs EUR/USD forex rate",
        ],
        inputModes: ["text/plain"],
        outputModes: ["application/json"],
      },
      {
        id: "execute_swap",
        name: "Execute Mento Swap",
        description:
          "Executes a Mento Broker stablecoin swap on Celo when arbitrage spread is favorable",
        tags: ["swap", "execution", "mento", "celo", "defi"],
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
          "Returns agent wallet balances, recent trades, and performance metrics",
        tags: ["portfolio", "status", "balance", "trades"],
        examples: ["Show agent portfolio", "What trades were executed today?"],
        inputModes: ["text/plain"],
        outputModes: ["application/json"],
      },
    ],
  });
}
