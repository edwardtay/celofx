import { createPublicClient, http, parseUnits, formatUnits, encodeFunctionData, type Address } from "viem";
import { celo } from "viem/chains";

// ─── Uniswap V3 on Celo Mainnet ───
export const UNISWAP_QUOTER_V2 = "0x82825d0554fA07f7FC52Ab63c961F330fdEFa8E8" as const;
export const UNISWAP_SWAP_ROUTER_02 = "0x5615CDAb10dc425a742d643d949a7F474C01abc4" as const;

// Tokens (including 6-decimal stablecoins)
export const UNI_TOKENS = {
  cUSD:  { address: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as Address, decimals: 18 },
  cEUR:  { address: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73" as Address, decimals: 18 },
  cREAL: { address: "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787" as Address, decimals: 18 },
  USDC:  { address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C" as Address, decimals: 6 },
  USDT:  { address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e" as Address, decimals: 6 },
  CELO:  { address: "0x471EcE3750Da237f93B8E339c536989b8978a438" as Address, decimals: 18 },
} as const;

export type UniToken = keyof typeof UNI_TOKENS;

// Known Uniswap V3 pools with liquidity on Celo
export const KNOWN_POOLS: Array<{ tokenA: UniToken; tokenB: UniToken; fee: number }> = [
  { tokenA: "USDT", tokenB: "cUSD",  fee: 100 },   // 0.01% — ~$1.29M TVL
  { tokenA: "cEUR", tokenB: "cUSD",  fee: 100 },   // 0.01% — ~$389K TVL
  { tokenA: "USDC", tokenB: "CELO",  fee: 100 },   // 0.01% — ~$80K TVL
  { tokenA: "CELO", tokenB: "cUSD",  fee: 100 },   // 0.01% — ~$35K TVL
];

// QuoterV2 ABI (quoteExactInputSingle)
const QUOTER_V2_ABI = [
  {
    name: "quoteExactInputSingle",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "fee", type: "uint24" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "sqrtPriceX96After", type: "uint160" },
      { name: "initializedTicksCrossed", type: "uint32" },
      { name: "gasEstimate", type: "uint256" },
    ],
  },
] as const;

const client = createPublicClient({
  chain: celo,
  transport: http("https://forno.celo.org"),
});

export interface UniswapQuote {
  tokenIn: UniToken;
  tokenOut: UniToken;
  amountIn: string;
  amountOut: string;
  rate: number;
  fee: number;
  gasEstimate: bigint;
  source: "uniswap-v3";
}

/**
 * Get a quote from Uniswap V3 QuoterV2 on Celo.
 * Uses simulate (eth_call) since QuoterV2 is non-view but stateless.
 */
export async function getUniswapQuote(
  tokenIn: UniToken,
  tokenOut: UniToken,
  amountIn: string = "1",
  fee?: number
): Promise<UniswapQuote> {
  const inInfo = UNI_TOKENS[tokenIn];
  const outInfo = UNI_TOKENS[tokenOut];

  // Find the pool fee if not specified
  const poolFee = fee ?? findPoolFee(tokenIn, tokenOut);
  if (!poolFee) {
    throw new Error(`No known Uniswap V3 pool for ${tokenIn}/${tokenOut}`);
  }

  const amountInWei = parseUnits(amountIn, inInfo.decimals);

  const result = await client.simulateContract({
    address: UNISWAP_QUOTER_V2,
    abi: QUOTER_V2_ABI,
    functionName: "quoteExactInputSingle",
    args: [
      {
        tokenIn: inInfo.address,
        tokenOut: outInfo.address,
        amountIn: amountInWei,
        fee: poolFee,
        sqrtPriceLimitX96: BigInt(0),
      },
    ],
  });

  const [amountOutWei, , , gasEstimate] = result.result as [bigint, bigint, number, bigint];
  const amountOutFormatted = formatUnits(amountOutWei, outInfo.decimals);
  const rate = Number(amountOutFormatted) / Number(amountIn);

  return {
    tokenIn,
    tokenOut,
    amountIn,
    amountOut: amountOutFormatted,
    rate,
    fee: poolFee,
    gasEstimate,
    source: "uniswap-v3",
  };
}

function findPoolFee(tokenA: UniToken, tokenB: UniToken): number | null {
  for (const pool of KNOWN_POOLS) {
    if (
      (pool.tokenA === tokenA && pool.tokenB === tokenB) ||
      (pool.tokenA === tokenB && pool.tokenB === tokenA)
    ) {
      return pool.fee;
    }
  }
  return null;
}

export interface CrossVenueRate {
  pair: string;
  mentoRate: number | null;
  uniswapRate: number | null;
  forexRate: number;
  venueSpread: number | null; // Mento vs Uniswap spread %
  mentoVsForex: number | null;
  uniswapVsForex: number | null;
  bestVenue: "mento" | "uniswap" | "tied";
}

/**
 * Compare rates across Mento, Uniswap V3, and Forex for arbitrage detection.
 */
export async function getCrossVenueRates(): Promise<CrossVenueRate[]> {
  // Fetch forex rates
  const forexRes = await fetch(
    "https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,BRL",
    { signal: AbortSignal.timeout(8000) }
  ).then(r => r.json()).catch(() => ({ rates: { EUR: 0.926, BRL: 5.7 } }));

  const eurPerUsd = forexRes.rates?.EUR ?? 0.926;

  // Fetch Mento rates
  const { getOnChainQuote } = await import("@/lib/mento-sdk");

  const results = await Promise.allSettled([
    getOnChainQuote("cUSD", "cEUR", "1"),          // Mento cUSD→cEUR
    getUniswapQuote("cEUR", "cUSD", "1"),           // Uniswap cEUR→cUSD
    getUniswapQuote("USDT", "cUSD", "1"),           // Uniswap USDT→cUSD (peg check)
    getOnChainQuote("cEUR", "cUSD", "1"),           // Mento cEUR→cUSD
  ]);

  const mentoEurPerUsd = results[0].status === "fulfilled" ? results[0].value.rate : null;
  const uniEurUsdPerEur = results[1].status === "fulfilled" ? results[1].value.rate : null;
  const uniUsdtRate = results[2].status === "fulfilled" ? results[2].value.rate : null;
  const mentoUsdPerEur = results[3].status === "fulfilled" ? results[3].value.rate : null;

  // Uniswap gives cUSD per cEUR, so EUR→USD rate. Invert for USD→EUR.
  const uniEurPerUsd = uniEurUsdPerEur ? 1 / uniEurUsdPerEur : null;

  const rates: CrossVenueRate[] = [];

  // cUSD/cEUR — the main arb pair
  rates.push({
    pair: "cUSD/cEUR",
    mentoRate: mentoEurPerUsd,
    uniswapRate: uniEurPerUsd,
    forexRate: eurPerUsd,
    venueSpread: mentoEurPerUsd && uniEurPerUsd
      ? ((mentoEurPerUsd - uniEurPerUsd) / uniEurPerUsd) * 100
      : null,
    mentoVsForex: mentoEurPerUsd
      ? ((mentoEurPerUsd - eurPerUsd) / eurPerUsd) * 100
      : null,
    uniswapVsForex: uniEurPerUsd
      ? ((uniEurPerUsd - eurPerUsd) / eurPerUsd) * 100
      : null,
    bestVenue: getBestVenue(mentoEurPerUsd, uniEurPerUsd, eurPerUsd),
  });

  // cEUR/cUSD — reverse direction
  const realUsdPerEur = 1 / eurPerUsd;
  rates.push({
    pair: "cEUR/cUSD",
    mentoRate: mentoUsdPerEur,
    uniswapRate: uniEurUsdPerEur,
    forexRate: realUsdPerEur,
    venueSpread: mentoUsdPerEur && uniEurUsdPerEur
      ? ((mentoUsdPerEur - uniEurUsdPerEur) / uniEurUsdPerEur) * 100
      : null,
    mentoVsForex: mentoUsdPerEur
      ? ((mentoUsdPerEur - realUsdPerEur) / realUsdPerEur) * 100
      : null,
    uniswapVsForex: uniEurUsdPerEur
      ? ((uniEurUsdPerEur - realUsdPerEur) / realUsdPerEur) * 100
      : null,
    bestVenue: getBestVenue(mentoUsdPerEur, uniEurUsdPerEur, realUsdPerEur),
  });

  // USDT/cUSD — stablecoin peg monitoring
  if (uniUsdtRate !== null) {
    const pegDeviation = ((uniUsdtRate - 1) / 1) * 100;
    rates.push({
      pair: "USDT/cUSD",
      mentoRate: null, // No Mento pool for USDT
      uniswapRate: uniUsdtRate,
      forexRate: 1.0, // Should be 1:1
      venueSpread: null,
      mentoVsForex: null,
      uniswapVsForex: pegDeviation,
      bestVenue: "uniswap",
    });
  }

  return rates;
}

function getBestVenue(
  mentoRate: number | null,
  uniRate: number | null,
  forexRate: number
): "mento" | "uniswap" | "tied" {
  if (!mentoRate && !uniRate) return "tied";
  if (!mentoRate) return "uniswap";
  if (!uniRate) return "mento";
  const mentoSpread = Math.abs(((mentoRate - forexRate) / forexRate) * 100);
  const uniSpread = Math.abs(((uniRate - forexRate) / forexRate) * 100);
  if (Math.abs(mentoSpread - uniSpread) < 0.05) return "tied";
  return mentoSpread > uniSpread ? "mento" : "uniswap";
}

// ─── SwapRouter02 ABI (exactInputSingle) ───
const SWAP_ROUTER_ABI = [
  {
    name: "exactInputSingle",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "recipient", type: "address" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "sqrtPriceLimitX96", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;

const ERC20_APPROVE_ABI = [
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

/**
 * Build Uniswap V3 swap transaction data (approve + exactInputSingle).
 * Returns tx params that can be sent via a wallet, same shape as buildSwapTx() in mento-sdk.
 */
export async function buildUniswapSwapTx(
  tokenIn: UniToken,
  tokenOut: UniToken,
  amountIn: string,
  recipient: Address,
  slippagePct: number = 1
) {
  const inInfo = UNI_TOKENS[tokenIn];
  const outInfo = UNI_TOKENS[tokenOut];

  const quote = await getUniswapQuote(tokenIn, tokenOut, amountIn);
  const amountInWei = parseUnits(amountIn, inInfo.decimals);
  const amountOutWei = parseUnits(quote.amountOut, outInfo.decimals);

  // Apply slippage tolerance
  const amountOutMinimum = (amountOutWei * BigInt(100 - slippagePct)) / BigInt(100);

  const approvalData = encodeFunctionData({
    abi: ERC20_APPROVE_ABI,
    functionName: "approve",
    args: [UNISWAP_SWAP_ROUTER_02 as Address, amountInWei],
  });

  const swapData = encodeFunctionData({
    abi: SWAP_ROUTER_ABI,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: inInfo.address,
        tokenOut: outInfo.address,
        fee: quote.fee,
        recipient,
        amountIn: amountInWei,
        amountOutMinimum,
        sqrtPriceLimitX96: BigInt(0),
      },
    ],
  });

  return {
    quote,
    approvalTx: {
      to: inInfo.address as Address,
      data: approvalData,
    },
    swapTx: {
      to: UNISWAP_SWAP_ROUTER_02 as Address,
      data: swapData,
    },
    summary: {
      tokenIn,
      tokenOut,
      amountIn,
      expectedOut: quote.amountOut,
      minOut: formatUnits(amountOutMinimum, outInfo.decimals),
      rate: quote.rate,
      slippagePct,
      venue: "uniswap-v3" as const,
    },
  };
}
