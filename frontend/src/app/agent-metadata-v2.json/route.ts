import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const filePath = join(process.cwd(), "public", "agent-metadata.json");
    const data = JSON.parse(readFileSync(filePath, "utf-8"));
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=60",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch {
    return NextResponse.json(
      {
        type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
        name: "CeloFX",
        description:
          "Autonomous FX arbitrage agent on Celo. Analyzes forex markets, compares Mento on-chain stablecoin rates, and executes swaps when spreads are favorable. Powered by Claude AI.",
        image: "https://celofx.vercel.app/celofx-logo.png",
        services: [
          { name: "web", endpoint: "https://celofx.vercel.app" },
          {
            name: "agentWallet",
            endpoint:
              "eip155:42220:0x6652AcDc623b7CCd52E115161d84b949bAf3a303",
          },
          {
            name: "MCP",
            endpoint: "https://celofx.vercel.app/api/mcp",
            version: "2025-06-18",
          },
          {
            name: "A2A",
            endpoint:
              "https://celofx.vercel.app/.well-known/agent-card.json",
            version: "0.3.0",
          },
          {
            name: "TEE",
            endpoint:
              "https://0e73394e6e0afc0e4de5cb899d11edf4edeb3cd5-3000.dstack-pha-prod9.phala.network/api/attestation",
            version: "dstack-dev-0.5.6",
            hardware: "Intel TDX",
            provider: "Phala Cloud",
          },
          {
            name: "OASF",
            endpoint: "https://github.com/agntcy/oasf/",
            version: "0.8.0",
            skills: [
              "analytical_skills",
              "tool_interaction",
              "advanced_reasoning_planning",
            ],
            domains: ["finance_and_business"],
            capabilities: [
              "autonomous_execution",
              "on_chain_verification",
              "cross_market_analysis",
            ],
          },
        ],
        x402Support: true,
        active: true,
        updatedAt: "2026-02-11T00:00:00Z",
        registrations: [
          {
            agentId: 10,
            agentRegistry:
              "eip155:42220:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
          },
        ],
        supportedTrust: ["reputation", "tee-attestation"],
        tee: {
          hardware: "Intel TDX",
          provider: "Phala Cloud",
          attestationEndpoint:
            "https://0e73394e6e0afc0e4de5cb899d11edf4edeb3cd5-3000.dstack-pha-prod9.phala.network/api/attestation",
          fallbackEndpoint: "https://celofx.vercel.app/api/attestation",
          cvmAppId: "0e73394e6e0afc0e4de5cb899d11edf4edeb3cd5",
          cvmDashboard:
            "https://cloud.phala.com/dashboard/cvms/app_0e73394e6e0afc0e4de5cb899d11edf4edeb3cd5",
        },
      },
      {
        headers: {
          "Cache-Control": "public, max-age=0, s-maxage=60",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}
