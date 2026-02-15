import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/format";

export async function GET() {
  const base = getBaseUrl();
  return NextResponse.json(
    {
      agent: "CeloFX",
      chainId: 42220,
      agentId: 10,
      layers: [
        {
          id: "eoa_signed",
          audience: "wallet users",
          auth: "wallet_signature",
          endpoint: `${base}/api/remittance/execute`,
          messageTemplate: "CeloFX Remittance Execute",
          notes: "User signs intent; agent executes swap + transfer on Celo.",
        },
        {
          id: "agent_api",
          audience: "other agents/apps",
          auth: "hmac_or_bearer",
          endpoint: `${base}/api/remittance/execute`,
          headers: ["x-agent-signature", "x-agent-timestamp", "x-agent-nonce", "authorization"],
          notes: "Programmatic access with replay-resistant request signing.",
        },
      ],
    },
    {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=60",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
