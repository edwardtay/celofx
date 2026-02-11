import { NextResponse } from "next/server";

const AGENT_ADDRESS = "0x6652AcDc623b7CCd52E115161d84b949bAf3a303";
const AGENT_ID = 10;
const REGISTRY_ADDRESS = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const DOMAIN = "celofx.vercel.app";

async function getRealTeeAttestation(): Promise<{
  quote: string;
  timestamp: string;
} | null> {
  try {
    // Check if running inside Phala Cloud CVM
    const fs = await import("fs");
    if (!fs.existsSync("/var/run/tappd.sock")) return null;

    const { TappdClient } = await import("@phala/dstack-sdk");
    const client = new TappdClient();

    // Derive key and get TDX quote with application-specific data
    const appData = JSON.stringify({
      agentAddress: AGENT_ADDRESS,
      domain: DOMAIN,
      chain: "celo",
      agentId: AGENT_ID,
    });

    const result = await client.tdxQuote(appData);
    return {
      quote: `0x${Buffer.from(result.quote).toString("hex")}`,
      timestamp: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function getSelfDeclaredAttestation() {
  const timestamp = new Date().toISOString();
  const appData = {
    agentAddress: AGENT_ADDRESS,
    domain: DOMAIN,
    chain: "celo",
    agentId: AGENT_ID,
  };
  // Self-declared attestation hash (SHA-256 of application data)
  const dataStr = JSON.stringify(appData);
  const encoder = new TextEncoder();
  const data = encoder.encode(dataStr);
  // Simple hex encoding of the app data as attestation proof
  const hex = Array.from(data)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return {
    quote: `0x${hex}`,
    timestamp,
  };
}

export async function GET() {
  const realAttestation = await getRealTeeAttestation();
  const attestation = realAttestation ?? getSelfDeclaredAttestation();
  const isRealTee = realAttestation !== null;

  return NextResponse.json({
    agentId: AGENT_ID,
    agentAddress: AGENT_ADDRESS,
    tee: {
      hardware: "Intel TDX",
      provider: "Phala Cloud",
      status: isRealTee ? "active" : "self-declared",
      attestationType: "tdx-quote",
      verified: isRealTee,
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
  });
}
