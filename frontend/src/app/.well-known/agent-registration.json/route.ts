import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    canonicalIdentity: {
      chainId: 42220,
      canonicalAgentId: 10,
      wallet: "0x6652AcDc623b7CCd52E115161d84b949bAf3a303",
      canonicalUrl: "https://www.8004scan.io/agents/celo/10",
      deprecatedAgentIds: [26],
    },
    registrations: [
      {
        agentId: 10,
        agentRegistry:
          "eip155:42220:0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
      },
    ],
  });
}
