import { createHash } from "crypto";
import { createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { REGISTRY_ABI, DECISION_REGISTRY_ADDRESS } from "./agent-policy";

const AGENT_ADDRESS = "0x6652AcDc623b7CCd52E115161d84b949bAf3a303";
const AGENT_ID = 10;

/** Derive domain from APP_BASE_URL env or fallback */
function getDomain(): string {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || "https://celofx.vercel.app";
  try { return new URL(base).hostname; } catch { return "celofx.vercel.app"; }
}

export interface TeeAttestation {
  status: "active" | "self-declared";
  verified: boolean;
  quote: string;
  timestamp: string;
  onChainTxHash?: string;
  environmentData?: Record<string, string>;
}

// Module-level flag: anchor attestation only once per process
let attestationAnchored = false;
let attestationAnchorTxHash: string | null = null;

async function anchorAttestationOnChain(quoteHash: string, attestationType: string): Promise<string | null> {
  if (attestationAnchored) return attestationAnchorTxHash;
  attestationAnchored = true;
  try {
    const pk = process.env.AGENT_PRIVATE_KEY as Hex | undefined;
    if (!pk) return null;
    const account = privateKeyToAccount(pk);
    const walletClient = createWalletClient({ account, chain: celo, transport: http("https://forno.celo.org") });
    const txHash = await walletClient.writeContract({
      address: DECISION_REGISTRY_ADDRESS,
      abi: REGISTRY_ABI,
      functionName: "anchorAttestation",
      args: [quoteHash as Hex, attestationType],
    });
    attestationAnchorTxHash = txHash;
    return txHash;
  } catch {
    attestationAnchored = false;
    return null;
  }
}

export function getAttestationAnchorStatus() {
  return { anchored: attestationAnchored, txHash: attestationAnchorTxHash };
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
      domain: getDomain(),
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

function getEnvironmentData(): Record<string, string> {
  return {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    vercelRegion: process.env.VERCEL_REGION || "local",
    vercelGitSha: process.env.VERCEL_GIT_COMMIT_SHA || "dev",
    deployTimestamp: process.env.VERCEL_GIT_COMMIT_SHA ? new Date().toISOString() : "local-dev",
    agentAddress: AGENT_ADDRESS,
    domain: getDomain(),
  };
}

function getSelfDeclaredAttestation(): { quote: string; timestamp: string; environmentData: Record<string, string> } {
  const timestamp = new Date().toISOString();
  const environmentData = getEnvironmentData();
  const appData = {
    agentAddress: AGENT_ADDRESS,
    domain: getDomain(),
    chain: "celo",
    agentId: AGENT_ID,
    environment: environmentData,
  };
  const dataStr = JSON.stringify(appData);
  const hex = createHash("sha256").update(dataStr).digest("hex");

  return { quote: `0x${hex}`, timestamp, environmentData };
}

export async function getAttestation(): Promise<TeeAttestation> {
  const realAttestation = await getRealTeeAttestation();
  const selfDeclared = getSelfDeclaredAttestation();
  const attestation = realAttestation ?? selfDeclared;
  const isRealTee = realAttestation !== null;
  const attestationType = isRealTee ? "tdx-quote" : "self-declared";

  // Fire-and-forget on-chain anchor (runs once per process)
  anchorAttestationOnChain(attestation.quote as Hex, attestationType);

  const result: TeeAttestation = {
    status: isRealTee ? "active" : "self-declared",
    verified: isRealTee,
    quote: attestation.quote,
    timestamp: attestation.timestamp,
  };

  if (!isRealTee) {
    result.environmentData = selfDeclared.environmentData;
  }
  if (attestationAnchorTxHash) {
    result.onChainTxHash = attestationAnchorTxHash;
  }

  return result;
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
