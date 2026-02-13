import { createPublicClient, http, formatUnits, type Address } from "viem";
import { celo } from "viem/chains";
import { TOKENS, type MentoToken } from "./mento-sdk";

// ─── Types ───
export interface TokenAllocation {
  token: MentoToken;
  targetPct: number;
}

export interface PortfolioHolding {
  token: MentoToken;
  balance: number;
  valueCusd: number;
  actualPct: number;
  targetPct: number;
  driftPct: number;
}

export interface PortfolioComposition {
  holdings: PortfolioHolding[];
  totalValueCusd: number;
  maxDriftPct: number;
  needsRebalance: boolean;
  timestamp: number;
}

// ─── Constants ───
export const DRIFT_THRESHOLD_PCT = 5;
const AGENT_ADDRESS = "0x6652AcDc623b7CCd52E115161d84b949bAf3a303" as Address;

const erc20BalanceAbi = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

const client = createPublicClient({
  chain: celo,
  transport: http("https://forno.celo.org"),
});

// ─── Mutable target allocation ───
let targetAllocation: TokenAllocation[] = [
  { token: "cUSD", targetPct: 60 },
  { token: "cEUR", targetPct: 25 },
  { token: "cREAL", targetPct: 15 },
];

export function getTargetAllocation(): TokenAllocation[] {
  return [...targetAllocation];
}

export function setTargetAllocation(alloc: TokenAllocation[]) {
  const total = alloc.reduce((s, a) => s + a.targetPct, 0);
  if (Math.abs(total - 100) > 0.01) {
    throw new Error(`Target allocation must sum to 100%, got ${total}%`);
  }
  targetAllocation = [...alloc];
}

// ─── Forex rate cache (60s) ───
let forexCache: { eurPerUsd: number; brlPerUsd: number; fetchedAt: number } | null = null;
const FOREX_CACHE_TTL = 60_000;

async function getForexRates(): Promise<{ eurPerUsd: number; brlPerUsd: number }> {
  if (forexCache && Date.now() - forexCache.fetchedAt < FOREX_CACHE_TTL) {
    return forexCache;
  }
  try {
    const res = await fetch(
      "https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,BRL",
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json();
    forexCache = {
      eurPerUsd: data.rates?.EUR ?? 0.926,
      brlPerUsd: data.rates?.BRL ?? 5.7,
      fetchedAt: Date.now(),
    };
  } catch {
    forexCache = { eurPerUsd: 0.926, brlPerUsd: 5.7, fetchedAt: Date.now() };
  }
  return forexCache;
}

// ─── Portfolio composition ───
export async function getPortfolioComposition(): Promise<PortfolioComposition> {
  const tokens: MentoToken[] = ["cUSD", "cEUR", "cREAL"];

  // Fetch balances and forex in parallel
  const [balances, forex] = await Promise.all([
    Promise.all(
      tokens.map(async (token) => {
        const raw = await client.readContract({
          address: TOKENS[token],
          abi: erc20BalanceAbi,
          functionName: "balanceOf",
          args: [AGENT_ADDRESS],
        });
        return { token, balance: parseFloat(formatUnits(raw, 18)) };
      })
    ),
    getForexRates(),
  ]);

  // Convert each balance to cUSD value
  // cUSD = 1:1, cEUR = 1/eurPerUsd (USD per EUR), cREAL = 1/brlPerUsd (USD per BRL)
  const usdPerToken: Record<MentoToken, number> = {
    cUSD: 1,
    cEUR: 1 / forex.eurPerUsd,
    cREAL: 1 / forex.brlPerUsd,
    CELO: 0, // not part of portfolio
    USDC: 1, // 1:1 USD peg
    USDT: 1, // 1:1 USD peg
  };

  const alloc = getTargetAllocation();
  const allocMap = new Map(alloc.map((a) => [a.token, a.targetPct]));

  let totalValueCusd = 0;
  const holdingsRaw: Array<{ token: MentoToken; balance: number; valueCusd: number; targetPct: number }> = [];

  for (const { token, balance } of balances) {
    const valueCusd = balance * usdPerToken[token];
    totalValueCusd += valueCusd;
    holdingsRaw.push({ token, balance, valueCusd, targetPct: allocMap.get(token) ?? 0 });
  }

  const holdings: PortfolioHolding[] = holdingsRaw.map((h) => {
    const actualPct = totalValueCusd > 0 ? (h.valueCusd / totalValueCusd) * 100 : 0;
    const driftPct = actualPct - h.targetPct;
    return {
      token: h.token,
      balance: h.balance,
      valueCusd: h.valueCusd,
      actualPct: Number(actualPct.toFixed(2)),
      targetPct: h.targetPct,
      driftPct: Number(driftPct.toFixed(2)),
    };
  });

  const maxDriftPct = Math.max(...holdings.map((h) => Math.abs(h.driftPct)));

  return {
    holdings,
    totalValueCusd: Number(totalValueCusd.toFixed(4)),
    maxDriftPct: Number(maxDriftPct.toFixed(2)),
    needsRebalance: maxDriftPct > DRIFT_THRESHOLD_PCT,
    timestamp: Date.now(),
  };
}
