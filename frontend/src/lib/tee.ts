import { createHash } from "crypto";

const AGENT_ADDRESS = "0x6652AcDc623b7CCd52E115161d84b949bAf3a303";
const AGENT_ID = 10;
const DOMAIN = "celofx.vercel.app";

export interface TeeAttestation {
  status: "active" | "self-declared";
  verified: boolean;
  quote: string;
  timestamp: string;
}

export function isRunningInTee(): boolean {
  try {
    const fs = require("fs");
    return (
      fs.existsSync("/var/run/dstack.sock") ||
      fs.existsSync("/var/run/tappd.sock")
    );
  } catch {
    return false;
  }
}

async function getRealTeeAttestation(): Promise<{
  quote: string;
  timestamp: string;
} | null> {
  try {
    if (!isRunningInTee()) return null;

    const { TappdClient } = await import("@phala/dstack-sdk");
    const client = new TappdClient();

    const appData = JSON.stringify({
      agentAddress: AGENT_ADDRESS,
      domain: DOMAIN,
      chain: "celo",
      agentId: AGENT_ID,
    });

    // TDX quote accepts max 64 bytes — hash the payload first
    const hash = createHash("sha256").update(appData).digest();
    const result = await client.tdxQuote(hash);
    return {
      quote: `0x${Buffer.from(result.quote).toString("hex")}`,
      timestamp: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function getSelfDeclaredAttestation(): { quote: string; timestamp: string } {
  const timestamp = new Date().toISOString();
  const appData = {
    agentAddress: AGENT_ADDRESS,
    domain: DOMAIN,
    chain: "celo",
    agentId: AGENT_ID,
  };
  const dataStr = JSON.stringify(appData);
  const hex = createHash("sha256").update(dataStr).digest("hex");

  return { quote: `0x${hex}`, timestamp };
}

export async function getAttestation(): Promise<TeeAttestation> {
  const realAttestation = await getRealTeeAttestation();
  const attestation = realAttestation ?? getSelfDeclaredAttestation();
  const isRealTee = realAttestation !== null;

  return {
    status: isRealTee ? "active" : "self-declared",
    verified: isRealTee,
    quote: attestation.quote,
    timestamp: attestation.timestamp,
  };
}

export function getTeeHeaders(): Record<string, string> {
  const inTee = isRunningInTee();
  return {
    "X-TEE-Status": inTee ? "active" : "self-declared",
    "X-TEE-Timestamp": new Date().toISOString(),
    "X-TEE-Provider": inTee ? "Phala Cloud" : "Vercel",
  };
}

export async function signWithTee(data: string): Promise<string> {
  try {
    if (!isRunningInTee()) throw new Error("No TDX");

    const { TappdClient } = await import("@phala/dstack-sdk");
    const client = new TappdClient();
    const hash = createHash("sha256").update(data).digest();
    const result = await client.tdxQuote(hash);
    return `0x${Buffer.from(result.quote).toString("hex")}`;
  } catch {
    return `0x${createHash("sha256").update(data).digest("hex")}`;
  }
}
