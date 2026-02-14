import { NextResponse } from "next/server";
import { getAttestation, getTeeHeaders, getAttestationAnchorStatus } from "@/lib/tee";
import { DECISION_REGISTRY_ADDRESS } from "@/lib/agent-policy";

const AGENT_ADDRESS = "0x6652AcDc623b7CCd52E115161d84b949bAf3a303";
const AGENT_ID = 10;
const IDENTITY_REGISTRY_ADDRESS = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";

export async function GET() {
  const attestation = await getAttestation();
  const anchorStatus = getAttestationAnchorStatus();

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
          domain: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://celofx.vercel.app").hostname,
          chain: "celo",
          agentId: AGENT_ID,
        },
        ...(attestation.environmentData && { environmentData: attestation.environmentData }),
      },
      onChainAnchor: {
        anchored: anchorStatus.anchored,
        txHash: anchorStatus.txHash,
        registryAddress: DECISION_REGISTRY_ADDRESS,
        celoscanLink: anchorStatus.txHash ? `https://celoscan.io/tx/${anchorStatus.txHash}` : null,
      },
      identity: {
        registry: IDENTITY_REGISTRY_ADDRESS,
        chain: "eip155:42220",
        tokenId: AGENT_ID,
      },
    },
    { headers: getTeeHeaders() }
  );
}
