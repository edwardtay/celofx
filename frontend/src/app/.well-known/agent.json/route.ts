import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/format";

export async function GET() {
  const base = getBaseUrl();
  return NextResponse.json(
    {
      name: "CeloFX",
      description:
        "Autonomous FX arbitrage agent on Celo with MCP, A2A, OASF, and x402.",
      homepage: base,
      version: "1.1.0",
      documentation: `${base}/developers`,
      endpoints: {
        mcp: `${base}/api/mcp`,
        a2a: `${base}/.well-known/agent-card.json`,
        mcp_manifest: `${base}/.well-known/mcp.json`,
        health: `${base}/api/health`,
        openapi: `${base}/api/openapi.json`,
        access_layers: `${base}/api/access-layers`,
      },
      protocols: ["MCP", "A2A", "OASF", "x402"],
      mcp: {
        endpoint: `${base}/api/mcp`,
        manifest: `${base}/.well-known/mcp.json`,
      },
      x402: {
        supported: true,
        x402_supported: true,
        x402Support: true,
        endpoint: `${base}/api/premium-signals`,
        amount: "0.10",
        currency: "cUSD",
        chain: "celo",
      },
      payment: {
        protocol: "x402",
        supported: true,
        endpoint: `${base}/api/premium-signals`,
      },
      registry: {
        chainId: 42220,
        tokenId: "10",
        agentId: "42220:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:10",
        contract: "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
        standard: "ERC-8004",
      },
      accessLayers: [
        {
          id: "eoa_signed",
          name: "EOA signed access",
          auth: "wallet_signature",
          endpoint: `${base}/api/remittance/execute`,
        },
        {
          id: "agent_api",
          name: "Agent API access",
          auth: "hmac_or_bearer",
          endpoint: `${base}/api/remittance/execute`,
        },
      ],
      canonicalIdentity: {
        canonicalAgentId: 10,
        wallet: "0x6652AcDc623b7CCd52E115161d84b949bAf3a303",
        canonicalUrl: "https://www.8004scan.io/agents/celo/10",
        deprecatedAgentIds: [26],
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
