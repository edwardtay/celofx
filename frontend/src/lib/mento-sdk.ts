import { createPublicClient, http, parseUnits, formatUnits, encodeFunctionData, type Address } from "viem";
import { celo } from "viem/chains";

// ─── Celo Mainnet Addresses (from @mento-protocol/mento-sdk) ───
export const BROKER = "0x777A8255cA72412f0d706dc03C9D1987306B4CaD" as const;
export const BIPOOL_MANAGER = "0x22d9db95E6Ae61c104A7B6F6C78D7993B94ec901" as const;

export const TOKENS = {
  cUSD: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as Address,
  cEUR: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73" as Address,
  cREAL: "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787" as Address,
  CELO: "0x471EcE3750Da237f93B8E339c536989b8978a438" as Address,
  USDC: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C" as Address,
  USDT: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e" as Address,
} as const;

export type MentoToken = keyof typeof TOKENS;

// ─── ABIs ───
const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const BROKER_ABI = [
  {
    name: "getAmountOut",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "exchangeProvider", type: "address" },
      { name: "exchangeId", type: "bytes32" },
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    name: "getAmountIn",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "exchangeProvider", type: "address" },
      { name: "exchangeId", type: "bytes32" },
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountOut", type: "uint256" },
    ],
    outputs: [{ name: "amountIn", type: "uint256" }],
  },
  {
    name: "swapIn",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "exchangeProvider", type: "address" },
      { name: "exchangeId", type: "bytes32" },
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;

const BIPOOL_MANAGER_ABI = [
  {
    name: "getExchanges",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        name: "exchanges",
        type: "tuple[]",
        components: [
          { name: "exchangeId", type: "bytes32" },
          { name: "assets", type: "address[]" },
        ],
      },
    ],
  },
] as const;

// ─── Viem client (server-side only, read-only) ───
const client = createPublicClient({
  chain: celo,
  transport: http("https://forno.celo.org"),
});

interface ExchangeInfo {
  exchangeId: `0x${string}`;
  assets: readonly Address[];
}

let exchangeCache: ExchangeInfo[] | null = null;
let exchangeCacheTime = 0;
const EXCHANGE_CACHE_TTL = 5 * 60_000; // 5 minutes

/**
 * Discover all tradeable pairs on Mento BiPoolManager
 */
async function getExchanges(): Promise<ExchangeInfo[]> {
  if (exchangeCache && Date.now() - exchangeCacheTime < EXCHANGE_CACHE_TTL) {
    return exchangeCache;
  }

  const result = await client.readContract({
    address: BIPOOL_MANAGER,
    abi: BIPOOL_MANAGER_ABI,
    functionName: "getExchanges",
  });

  exchangeCache = result as unknown as ExchangeInfo[];
  exchangeCacheTime = Date.now();
  return exchangeCache;
}

/**
 * Find the exchange ID for a given token pair
 */
async function findExchangeId(
  tokenIn: Address,
  tokenOut: Address
): Promise<`0x${string}` | null> {
  const exchanges = await getExchanges();

  for (const ex of exchanges) {
    const assets = ex.assets.map((a) => a.toLowerCase());
    if (
      assets.includes(tokenIn.toLowerCase()) &&
      assets.includes(tokenOut.toLowerCase())
    ) {
      return ex.exchangeId;
    }
  }
  return null;
}

export interface OnChainQuote {
  tokenIn: MentoToken;
  tokenOut: MentoToken;
  amountIn: string;
  amountOut: string;
  rate: number; // tokenOut per tokenIn
  exchangeId: string;
}

/**
 * Get on-chain quote from Mento Broker — real protocol rate, not CoinGecko
 */
export async function getOnChainQuote(
  tokenIn: MentoToken,
  tokenOut: MentoToken,
  amountIn: string = "1" // human-readable amount
): Promise<OnChainQuote> {
  const tokenInAddr = TOKENS[tokenIn];
  const tokenOutAddr = TOKENS[tokenOut];

  const exchangeId = await findExchangeId(tokenInAddr, tokenOutAddr);
  if (!exchangeId) {
    throw new Error(`No Mento exchange found for ${tokenIn}/${tokenOut}`);
  }

  const amountInWei = parseUnits(amountIn, 18);

  const amountOutWei = await client.readContract({
    address: BROKER,
    abi: BROKER_ABI,
    functionName: "getAmountOut",
    args: [BIPOOL_MANAGER, exchangeId, tokenInAddr, tokenOutAddr, amountInWei],
  });

  const amountOutFormatted = formatUnits(amountOutWei, 18);
  const rate = Number(amountOutFormatted) / Number(amountIn);

  return {
    tokenIn,
    tokenOut,
    amountIn,
    amountOut: amountOutFormatted,
    rate,
    exchangeId,
  };
}

/**
 * Minimum profitable spread threshold.
 * Derived from: Celo gas cost (~$0.001 per tx, negligible) + slippage safety buffer (0.05%)
 * + minimum profit margin (0.25%). getAmountOut() returns net-of-protocol-fee rates,
 * so this threshold IS the expected profit per trade.
 */
export const MIN_PROFITABLE_SPREAD_PCT = 0.3;

export interface MentoOnChainRate {
  pair: string;
  mentoRate: number;
  forexRate: number;
  spread: number;
  spreadPct: number;
  direction: "buy" | "sell" | "neutral";
  source: "on-chain";
  exchangeId: string;
  forexAge?: number; // seconds since forex data was fetched
}

/**
 * Get Mento on-chain rates and compare with real forex rates.
 * Checks BOTH directions per pair (cUSD→cEUR and cEUR→cUSD) to find
 * the profitable side. Tracks forex data freshness.
 */
export async function getMentoOnChainRates(): Promise<MentoOnChainRate[]> {
  // Fetch real forex rates from Frankfurter
  const forexFetchTime = Date.now();
  const forexRes = await fetch(
    "https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,BRL",
    { signal: AbortSignal.timeout(8000) }
  );
  const forex = forexRes.ok
    ? await forexRes.json()
    : { rates: { EUR: 0.926, BRL: 5.7 } };

  const realEurPerUsd = forex.rates?.EUR ?? 0.926;
  const realBrlPerUsd = forex.rates?.BRL ?? 5.7;
  const forexAge = () => Math.round((Date.now() - forexFetchTime) / 1000);

  // Fetch on-chain Mento rates in BOTH directions, in parallel
  const [cUsdToEur, cEurToUsd, cUsdToReal, cRealToUsd] = await Promise.allSettled([
    getOnChainQuote("cUSD", "cEUR", "1"),
    getOnChainQuote("cEUR", "cUSD", "1"),
    getOnChainQuote("cUSD", "cREAL", "1"),
    getOnChainQuote("cREAL", "cUSD", "1"),
  ]);

  const rates: MentoOnChainRate[] = [];

  // cUSD → cEUR (forward: buying cEUR with cUSD)
  if (cUsdToEur.status === "fulfilled") {
    const mentoRate = cUsdToEur.value.rate;
    const spread = mentoRate - realEurPerUsd;
    const spreadPct = (spread / realEurPerUsd) * 100;
    rates.push({
      pair: "cUSD/cEUR",
      mentoRate: Number(mentoRate.toFixed(6)),
      forexRate: Number(realEurPerUsd.toFixed(6)),
      spread: Number(spread.toFixed(6)),
      spreadPct: Number(spreadPct.toFixed(3)),
      direction:
        spreadPct > MIN_PROFITABLE_SPREAD_PCT ? "buy" : spreadPct < -0.1 ? "sell" : "neutral",
      source: "on-chain",
      exchangeId: cUsdToEur.value.exchangeId,
      forexAge: forexAge(),
    });
  }

  // cEUR → cUSD (reverse: selling cEUR for cUSD)
  if (cEurToUsd.status === "fulfilled") {
    const mentoRate = cEurToUsd.value.rate; // USD per EUR from Mento
    const realUsdPerEur = 1 / realEurPerUsd;
    const spread = mentoRate - realUsdPerEur;
    const spreadPct = (spread / realUsdPerEur) * 100;
    rates.push({
      pair: "cEUR/cUSD",
      mentoRate: Number(mentoRate.toFixed(6)),
      forexRate: Number(realUsdPerEur.toFixed(6)),
      spread: Number(spread.toFixed(6)),
      spreadPct: Number(spreadPct.toFixed(3)),
      direction:
        spreadPct > MIN_PROFITABLE_SPREAD_PCT ? "buy" : spreadPct < -0.1 ? "sell" : "neutral",
      source: "on-chain",
      exchangeId: cEurToUsd.value.exchangeId,
      forexAge: forexAge(),
    });
  }

  // cUSD → cREAL (forward: buying cREAL with cUSD)
  if (cUsdToReal.status === "fulfilled") {
    const mentoRate = cUsdToReal.value.rate;
    const spread = mentoRate - realBrlPerUsd;
    const spreadPct = (spread / realBrlPerUsd) * 100;
    rates.push({
      pair: "cUSD/cREAL",
      mentoRate: Number(mentoRate.toFixed(4)),
      forexRate: Number(realBrlPerUsd.toFixed(4)),
      spread: Number(spread.toFixed(4)),
      spreadPct: Number(spreadPct.toFixed(3)),
      direction:
        spreadPct > MIN_PROFITABLE_SPREAD_PCT ? "buy" : spreadPct < -0.1 ? "sell" : "neutral",
      source: "on-chain",
      exchangeId: cUsdToReal.value.exchangeId,
      forexAge: forexAge(),
    });
  }

  // cREAL → cUSD (reverse: selling cREAL for cUSD)
  if (cRealToUsd.status === "fulfilled") {
    const mentoRate = cRealToUsd.value.rate; // USD per BRL from Mento
    const realUsdPerBrl = 1 / realBrlPerUsd;
    const spread = mentoRate - realUsdPerBrl;
    const spreadPct = (spread / realUsdPerBrl) * 100;
    rates.push({
      pair: "cREAL/cUSD",
      mentoRate: Number(mentoRate.toFixed(6)),
      forexRate: Number(realUsdPerBrl.toFixed(6)),
      spread: Number(spread.toFixed(6)),
      spreadPct: Number(spreadPct.toFixed(3)),
      direction:
        spreadPct > MIN_PROFITABLE_SPREAD_PCT ? "buy" : spreadPct < -0.1 ? "sell" : "neutral",
      source: "on-chain",
      exchangeId: cRealToUsd.value.exchangeId,
      forexAge: forexAge(),
    });
  }

  return rates;
}

/**
 * Build swap transaction data for the Mento Broker.
 * Returns the tx params that can be sent via a wallet.
 */
export async function buildSwapTx(
  tokenIn: MentoToken,
  tokenOut: MentoToken,
  amountIn: string,
  slippagePct: number = 1 // 1% slippage
) {
  const quote = await getOnChainQuote(tokenIn, tokenOut, amountIn);
  const amountInWei = parseUnits(amountIn, 18);
  const amountOutWei = parseUnits(quote.amountOut, 18);

  // Apply slippage tolerance
  const minAmountOut = (amountOutWei * BigInt(100 - slippagePct)) / BigInt(100);

  const approvalData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "approve",
    args: [BROKER, amountInWei],
  });

  const swapData = encodeFunctionData({
    abi: BROKER_ABI,
    functionName: "swapIn",
    args: [
      BIPOOL_MANAGER,
      quote.exchangeId as `0x${string}`,
      TOKENS[tokenIn],
      TOKENS[tokenOut],
      amountInWei,
      minAmountOut,
    ],
  });

  return {
    quote,
    approvalTx: {
      to: TOKENS[tokenIn] as Address,
      data: approvalData,
    },
    swapTx: {
      to: BROKER as Address,
      data: swapData,
    },
    summary: {
      tokenIn,
      tokenOut,
      amountIn,
      expectedOut: quote.amountOut,
      minOut: formatUnits(minAmountOut, 18),
      rate: quote.rate,
      slippagePct,
    },
  };
}
