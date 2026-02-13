import { NextResponse } from "next/server";
import { getAttestation, getTeeHeaders } from "@/lib/tee";

const AGENT_ADDRESS = "0x6652AcDc623b7CCd52E115161d84b949bAf3a303";
const AGENT_ID = 10;
const REGISTRY_ADDRESS = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const DOMAIN = "celofx.vercel.app";

// Serves attestation directly (8004scan doesn't follow redirects)
export async function GET() {
  const attestation = await getAttestation();

  return NextResponse.json(
    {
      agentId: AGENT_ID,
      agentAddress: AGENT_ADDRESS,
      tee: {
        status: attestation.status,
        verified: attestation.verified,
        attestationType: attestation.verified ? "tdx-quote" : "keccak256-hash",
        infrastructure: attestation.verified ? "Intel TDX (Phala Cloud)" : "Vercel",
      },
      attestation: {
        type: "tee-attestation",
        timestamp: attestation.timestamp,
        quote: attestation.quote,
        applicationData: {
          agentAddress: AGENT_ADDRESS,
          domain: DOMAIN,
          chain: "celo",
          agentId: AGENT_ID,
        },
      },
      identity: {
        registry: REGISTRY_ADDRESS,
        chain: "eip155:42220",
        tokenId: AGENT_ID,
      },
    },
    { headers: getTeeHeaders() }
  );
}
