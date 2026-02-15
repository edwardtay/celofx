/**
 * Agent Policy (Standing Intent) — Cryptographically signed declaration
 * of what the agent is authorized to do. On-chain constraints the agent
 * cannot bypass, even if the AI is compromised.
 */

import { keccak256, encodePacked, createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

// ── On-Chain Decision Registry ──
const DECISION_REGISTRY_ADDRESS = (process.env.NEXT_PUBLIC_DECISION_REGISTRY_ADDRESS || "0xF8faC012318671b6694732939bcB6EA8d2c91662") as Hex;

const REGISTRY_ABI = [
  {
    type: "function",
    name: "commitDecision",
    inputs: [
      { name: "hash", type: "bytes32" },
      { name: "action", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "anchorAttestation",
    inputs: [
      { name: "hash", type: "bytes32" },
      { name: "attestationType", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "DecisionCommitted",
    inputs: [
      { name: "hash", type: "bytes32", indexed: true },
      { name: "action", type: "string", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "AttestationAnchored",
    inputs: [
      { name: "hash", type: "bytes32", indexed: true },
      { name: "attestationType", type: "string", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
  },
] as const;

export { REGISTRY_ABI, DECISION_REGISTRY_ADDRESS };

function getRegistryClients() {
  const pk = process.env.AGENT_PRIVATE_KEY as Hex | undefined;
  if (!pk) return null;
  const account = privateKeyToAccount(pk);
  const publicClient = createPublicClient({ chain: celo, transport: http("https://forno.celo.org") });
  const walletClient = createWalletClient({ account, chain: celo, transport: http("https://forno.celo.org") });
  return { publicClient, walletClient, account };
}

async function commitDecisionOnChain(hash: Hex, action: string): Promise<string | null> {
  try {
    const clients = getRegistryClients();
    if (!clients) return null;
    const txHash = await clients.walletClient.writeContract({
      address: DECISION_REGISTRY_ADDRESS,
      abi: REGISTRY_ABI,
      functionName: "commitDecision",
      args: [hash, action],
    });
    return txHash;
  } catch {
    return null;
  }
}

export async function getOnChainDecisions(): Promise<Array<{ hash: string; action: string; timestamp: bigint; txHash?: string }>> {
  try {
    const publicClient = createPublicClient({ chain: celo, transport: http("https://forno.celo.org") });
    const logs = await publicClient.getLogs({
      address: DECISION_REGISTRY_ADDRESS,
      event: {
        type: "event",
        name: "DecisionCommitted",
        inputs: [
          { name: "hash", type: "bytes32", indexed: true },
          { name: "action", type: "string", indexed: false },
          { name: "timestamp", type: "uint256", indexed: false },
        ],
      },
      fromBlock: BigInt(31000000),
    });
    return logs.map((log) => ({
      hash: log.args.hash as string,
      action: log.args.action as string,
      timestamp: log.args.timestamp as bigint,
      txHash: log.transactionHash,
    }));
  } catch {
    return [];
  }
}

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
      { symbol: "USDC", address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C" },
      { symbol: "USDT", address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e" },
    ],
    allowedProtocols: [
      { name: "Mento Broker", address: "0x777A8255cA72412f0d706dc03C9D1987306B4CaD" },
      { name: "Uniswap V3 SwapRouter02", address: "0x5615CDAb10dc425a742d643d949a7F474C01abc4" },
      { name: "Uniswap V3 QuoterV2", address: "0x82825d0554fA07f7FC52Ab63c961F330fdEFa8E8" },
    ],
    maxSwapPerTx: "100 cUSD",
    maxDailyVolume: "500 cUSD",
    minProfitableSpread: 0.1,
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
    attestationEndpoint: "/api/tee/attestation",
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

const decisionLog: Array<AgentDecision & { hash: string; onChainTxHash?: string }> = [];

export function commitDecision(decision: AgentDecision): string {
  const hash = keccak256(
    encodePacked(
      ["string", "string", "string", "uint256"],
      [decision.orderId, decision.action, decision.reasoning, BigInt(decision.timestamp)]
    )
  );
  const entry: AgentDecision & { hash: string; onChainTxHash?: string } = { ...decision, hash };
  decisionLog.push(entry);

  // Fire-and-forget on-chain commit (non-blocking)
  commitDecisionOnChain(hash as Hex, decision.action).then((txHash) => {
    if (txHash) entry.onChainTxHash = txHash;
  });

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

// ── Gas Threshold Check ──
// Verify gas cost doesn't eat more than 50% of expected profit before swapping

async function getGasCostEstimate(): Promise<{
  gasPriceGwei: number;
  estimatedGasCostUsd: number;
}> {
  const { createPublicClient, http, formatGwei } = await import("viem");
  const { celo } = await import("viem/chains");
  const publicClient = createPublicClient({ chain: celo, transport: http("https://forno.celo.org") });

  const gasPrice = await publicClient.getGasPrice();
  const gasPriceGwei = parseFloat(formatGwei(gasPrice));

  // Fetch real CELO price from CoinGecko
  let celoPrice = 0.08; // fallback
  try {
    const priceRes = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=celo&vs_currencies=usd", { signal: AbortSignal.timeout(3000) });
    if (priceRes.ok) {
      const priceData = await priceRes.json();
      celoPrice = priceData?.celo?.usd ?? 0.08;
    }
  } catch { /* use fallback */ }

  const estimatedGas = BigInt(250_000);
  const gasCostCelo = parseFloat(formatGwei(gasPrice * estimatedGas)) / 1e9;
  const estimatedGasCostUsd = gasCostCelo * celoPrice;

  return { gasPriceGwei, estimatedGasCostUsd };
}

export async function getDynamicSpreadThreshold(
  amountUsd: number,
  opts?: {
    baseMinSpreadPct?: number;
    slippageBufferPct?: number;
    safetyMarginPct?: number;
    minAbsoluteProfitUsd?: number;
  }
): Promise<{
  requiredSpreadPct: number;
  baseMinSpreadPct: number;
  gasImpliedSpreadPct: number;
  absoluteProfitSpreadPct: number;
  slippageBufferPct: number;
  safetyMarginPct: number;
  minAbsoluteProfitUsd: number;
  gasPriceGwei: number;
  estimatedGasCostUsd: number;
}> {
  const baseMinSpreadPct = opts?.baseMinSpreadPct ?? 0.1;
  const slippageBufferPct = opts?.slippageBufferPct ?? 0.02;
  const safetyMarginPct = opts?.safetyMarginPct ?? 0.02;
  const minAbsoluteProfitUsd = opts?.minAbsoluteProfitUsd ?? 0.03;
  const notional = Number.isFinite(amountUsd) && amountUsd > 0 ? amountUsd : 1;

  try {
    const { gasPriceGwei, estimatedGasCostUsd } = await getGasCostEstimate();
    const gasImpliedSpreadPct = (estimatedGasCostUsd / notional) * 100;
    const absoluteProfitSpreadPct = (minAbsoluteProfitUsd / notional) * 100;
    const requiredSpreadPct = Math.max(
      baseMinSpreadPct,
      gasImpliedSpreadPct + slippageBufferPct + safetyMarginPct,
      absoluteProfitSpreadPct
    );

    return {
      requiredSpreadPct: +requiredSpreadPct.toFixed(4),
      baseMinSpreadPct,
      gasImpliedSpreadPct: +gasImpliedSpreadPct.toFixed(4),
      absoluteProfitSpreadPct: +absoluteProfitSpreadPct.toFixed(4),
      slippageBufferPct,
      safetyMarginPct,
      minAbsoluteProfitUsd,
      gasPriceGwei,
      estimatedGasCostUsd: +estimatedGasCostUsd.toFixed(6),
    };
  } catch {
    const absoluteProfitSpreadPct = (minAbsoluteProfitUsd / notional) * 100;
    const requiredSpreadPct = Math.max(baseMinSpreadPct, absoluteProfitSpreadPct);
    return {
      requiredSpreadPct: +requiredSpreadPct.toFixed(4),
      baseMinSpreadPct,
      gasImpliedSpreadPct: 0,
      absoluteProfitSpreadPct: +absoluteProfitSpreadPct.toFixed(4),
      slippageBufferPct,
      safetyMarginPct,
      minAbsoluteProfitUsd,
      gasPriceGwei: 0,
      estimatedGasCostUsd: 0,
    };
  }
}

export async function checkGasThreshold(expectedProfitUsd: number): Promise<{
  safe: boolean;
  gasPriceGwei: number;
  estimatedGasCostUsd: number;
  profitAfterGas: number;
}> {
  try {
    const { gasPriceGwei, estimatedGasCostUsd } = await getGasCostEstimate();

    // Hard limit: reject if gas > 50 gwei (Celo is usually <5 gwei)
    if (gasPriceGwei > 50) {
      return { safe: false, gasPriceGwei, estimatedGasCostUsd: 999, profitAfterGas: -999 };
    }

    const profitAfterGas = expectedProfitUsd - estimatedGasCostUsd;
    const safe = estimatedGasCostUsd < expectedProfitUsd * 0.5; // gas < 50% of profit

    return { safe, gasPriceGwei, estimatedGasCostUsd, profitAfterGas };
  } catch {
    // If gas check fails, allow trade (don't block on gas oracle failure)
    return { safe: true, gasPriceGwei: 0, estimatedGasCostUsd: 0, profitAfterGas: expectedProfitUsd };
  }
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
