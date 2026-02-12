/**
 * Agent Policy (Standing Intent) — Cryptographically signed declaration
 * of what the agent is authorized to do. On-chain constraints the agent
 * cannot bypass, even if the AI is compromised.
 */

import { keccak256, encodePacked } from "viem";

export const AGENT_POLICY = {
  version: "1.0",
  agentId: 10,
  chain: "celo",
  chainId: 42220,
  agentAddress: "0x6652AcDc623b7CCd52E115161d84b949bAf3a303",
  ownerAddress: "0x6652AcDc623b7CCd52E115161d84b949bAf3a303",
  issuedAt: 1739318400,

  permissions: {
    allowedTokens: [
      { symbol: "cUSD", address: "0x765DE816845861e75A25fCA122bb6898B8B1282a" },
      { symbol: "cEUR", address: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73" },
      { symbol: "cREAL", address: "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787" },
    ],
    allowedProtocols: [
      { name: "Mento Broker", address: "0x777A8255cA72412f0d706dc03C9D1987306B4CaD" },
    ],
    maxSwapPerTx: "100 cUSD",
    maxDailyVolume: "500 cUSD",
    minProfitableSpread: 0.3,
  },

  decisionFramework: {
    requiredChecks: ["momentum", "volatility", "urgency", "forexSignal", "spreadVsForex"],
    neverExecuteConditions: [
      "rate < target AND gap > 2% AND not urgent",
      "spreadVsForexPct < -1% (forex disagrees with Mento)",
    ],
    model: "claude-sonnet-4-5-20250929",
  },

  trust: {
    identity: "ERC-8004 #10 on Celo",
    reputation: "ERC-8004 Reputation Registry",
    tee: "Intel TDX via Phala Cloud",
    attestationEndpoint: "https://celofx.vercel.app/api/tee/attestation",
  },
} as const;

// Hash the policy for verification
export function hashPolicy(): string {
  const json = JSON.stringify(AGENT_POLICY);
  return keccak256(encodePacked(["string"], [json]));
}

// Decision commitment — hash before execution for auditability
export interface AgentDecision {
  orderId: string;
  action: "execute" | "wait" | "skip";
  reasoning: string;
  timestamp: number;
  currentRate: number;
  targetRate: number;
  momentum: string;
  urgency: string;
}

const decisionLog: Array<AgentDecision & { hash: string }> = [];

export function commitDecision(decision: AgentDecision): string {
  const hash = keccak256(
    encodePacked(
      ["string", "string", "string", "uint256"],
      [decision.orderId, decision.action, decision.reasoning, BigInt(decision.timestamp)]
    )
  );
  decisionLog.push({ ...decision, hash });
  return hash;
}

export function getDecisionLog() {
  return [...decisionLog];
}

export function verifyDecision(decision: AgentDecision, expectedHash: string): boolean {
  const hash = keccak256(
    encodePacked(
      ["string", "string", "string", "uint256"],
      [decision.orderId, decision.action, decision.reasoning, BigInt(decision.timestamp)]
    )
  );
  return hash === expectedHash;
}

// ── Daily Volume Tracker ──
// Enforces the maxDailyVolume policy limit (500 cUSD rolling 24h window)

const MAX_DAILY_VOLUME_USD = 500;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

interface VolumeEntry {
  amount: number;
  timestamp: number;
}

const volumeLog: VolumeEntry[] = [];

function pruneOldEntries() {
  const cutoff = Date.now() - TWENTY_FOUR_HOURS;
  while (volumeLog.length > 0 && volumeLog[0].timestamp < cutoff) {
    volumeLog.shift();
  }
}

export function getDailyVolume(): number {
  pruneOldEntries();
  return volumeLog.reduce((sum, e) => sum + e.amount, 0);
}

export function checkVolumeLimit(amountUsd: number): {
  allowed: boolean;
  currentVolume: number;
  limit: number;
  remaining: number;
} {
  pruneOldEntries();
  const current = volumeLog.reduce((sum, e) => sum + e.amount, 0);
  const remaining = Math.max(0, MAX_DAILY_VOLUME_USD - current);
  return {
    allowed: current + amountUsd <= MAX_DAILY_VOLUME_USD,
    currentVolume: +current.toFixed(2),
    limit: MAX_DAILY_VOLUME_USD,
    remaining: +remaining.toFixed(2),
  };
}

export function recordVolume(amountUsd: number) {
  volumeLog.push({ amount: amountUsd, timestamp: Date.now() });
}

export function getVolumeLog() {
  pruneOldEntries();
  return [...volumeLog];
}

// ── Circuit Breaker ──
// Emergency pause — checked before any swap execution

export function isAgentPaused(): boolean {
  return process.env.AGENT_PAUSED === "true";
}

export function getAgentStatus(): {
  paused: boolean;
  dailyVolume: number;
  dailyLimit: number;
  decisionsLogged: number;
} {
  return {
    paused: isAgentPaused(),
    dailyVolume: getDailyVolume(),
    dailyLimit: MAX_DAILY_VOLUME_USD,
    decisionsLogged: decisionLog.length,
  };
}
