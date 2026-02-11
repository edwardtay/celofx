import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  encodeFunctionData,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

interface Env {
  KV: KVNamespace;
  AGENT_PRIVATE_KEY?: string;
  SCAN_SECRET?: string;
}

// ─── Celo Mainnet Addresses ───
const BROKER = "0x777A8255cA72412f0d706dc03C9D1987306B4CaD" as const;
const BIPOOL_MANAGER =
  "0x22d9db95E6Ae61c104A7B6F6C78D7993B94ec901" as const;

const TOKENS: Record<string, Address> = {
  cUSD: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
  cEUR: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73",
  cREAL: "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787",
};

// ─── ABIs ───
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

const BIPOOL_ABI = [
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
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

// ─── Helpers ───

const ALLOWED_ORIGINS = [
  "https://celofx.vercel.app",
  "http://localhost:3000",
];

function cors(data: unknown, status = 200, origin?: string | null): Response {
  const allowedOrigin =
    origin && ALLOWED_ORIGINS.some((o) => origin === o || origin.endsWith(".vercel.app"))
      ? origin
      : ALLOWED_ORIGINS[0];

  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

function findExchangeId(
  exchanges: Array<{ exchangeId: `0x${string}`; assets: Address[] }>,
  tokenIn: Address,
  tokenOut: Address
): `0x${string}` | null {
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

// ─── Autonomous swap execution ───

const SPREAD_THRESHOLD = 0.3; // Execute if |spread| > 0.3%
const SWAP_AMOUNT = "0.5"; // Small amount per autonomous swap

async function executeSwap(
  env: Env,
  pair: { from: string; to: string },
  exchangeId: `0x${string}`,
  pc: ReturnType<typeof createPublicClient>
): Promise<{
  success: boolean;
  approvalTxHash?: string;
  swapTxHash?: string;
  amountIn?: string;
  amountOut?: string;
  rate?: number;
  error?: string;
}> {
  if (!env.AGENT_PRIVATE_KEY) {
    return { success: false, error: "No private key configured" };
  }

  const pk = (
    env.AGENT_PRIVATE_KEY.startsWith("0x")
      ? env.AGENT_PRIVATE_KEY
      : `0x${env.AGENT_PRIVATE_KEY}`
  ) as `0x${string}`;
  const account = privateKeyToAccount(pk);
  const wallet = createWalletClient({
    account,
    chain: celo,
    transport: http("https://forno.celo.org"),
  });

  const tokenIn = TOKENS[pair.from];
  const tokenOut = TOKENS[pair.to];
  const amountIn = parseUnits(SWAP_AMOUNT, 18);
  const feeCurrency = TOKENS.cUSD as `0x${string}`;

  // Check balance
  const balance = await pc.readContract({
    address: tokenIn,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [account.address],
  });

  if (balance < amountIn) {
    return {
      success: false,
      error: `Insufficient ${pair.from}: ${formatUnits(balance, 18)}`,
    };
  }

  // Quote
  const amountOut = await pc.readContract({
    address: BROKER,
    abi: BROKER_ABI,
    functionName: "getAmountOut",
    args: [BIPOOL_MANAGER, exchangeId, tokenIn, tokenOut, amountIn],
  });

  const rate = Number(formatUnits(amountOut, 18)) / Number(SWAP_AMOUNT);

  // Approve
  const approveData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "approve",
    args: [BROKER, amountIn],
  });
  const approvalHash = await wallet.sendTransaction({
    to: tokenIn,
    data: approveData,
    feeCurrency,
  });
  await pc.waitForTransactionReceipt({ hash: approvalHash });

  // Swap (1% slippage)
  const minOut = (amountOut * 99n) / 100n;
  const swapData = encodeFunctionData({
    abi: BROKER_ABI,
    functionName: "swapIn",
    args: [BIPOOL_MANAGER, exchangeId, tokenIn, tokenOut, amountIn, minOut],
  });
  const swapHash = await wallet.sendTransaction({
    to: BROKER,
    data: swapData,
    feeCurrency,
  });
  const receipt = await pc.waitForTransactionReceipt({ hash: swapHash });

  return {
    success: receipt.status === "success",
    approvalTxHash: approvalHash,
    swapTxHash: swapHash,
    amountIn: SWAP_AMOUNT,
    amountOut: formatUnits(amountOut, 18),
    rate,
  };
}

// ─── Core scan + execute logic ───

async function scan(env: Env) {
  const pc = createPublicClient({
    chain: celo,
    transport: http("https://forno.celo.org"),
  });

  // 1. Fetch forex rates
  const forexRes = await fetch(
    "https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,BRL"
  );
  const forex: { rates?: { EUR?: number; BRL?: number } } = forexRes.ok
    ? await forexRes.json()
    : { rates: { EUR: 0.926, BRL: 5.7 } };
  const realEurPerUsd = forex.rates?.EUR ?? 0.926;
  const realBrlPerUsd = forex.rates?.BRL ?? 5.7;

  // 2. Discover exchanges
  const rawExchanges = await pc.readContract({
    address: BIPOOL_MANAGER,
    abi: BIPOOL_ABI,
    functionName: "getExchanges",
  });
  const exchanges = rawExchanges as unknown as Array<{
    exchangeId: `0x${string}`;
    assets: Address[];
  }>;

  // 3. On-chain quotes
  const amountIn = parseUnits("1", 18);
  const rates: Array<{
    pair: string;
    mentoRate: number;
    forexRate: number;
    spread: number;
    spreadPct: number;
    direction: string;
    exchangeId: string;
  }> = [];

  const eurExId = findExchangeId(exchanges, TOKENS.cUSD, TOKENS.cEUR);
  if (eurExId) {
    const amountOut = await pc.readContract({
      address: BROKER,
      abi: BROKER_ABI,
      functionName: "getAmountOut",
      args: [BIPOOL_MANAGER, eurExId, TOKENS.cUSD, TOKENS.cEUR, amountIn],
    });
    const mentoRate = Number(formatUnits(amountOut, 18));
    const spread = mentoRate - realEurPerUsd;
    const spreadPct = (spread / realEurPerUsd) * 100;
    rates.push({
      pair: "cUSD/cEUR",
      mentoRate: +mentoRate.toFixed(6),
      forexRate: +realEurPerUsd.toFixed(6),
      spread: +spread.toFixed(6),
      spreadPct: +spreadPct.toFixed(3),
      direction:
        spreadPct > 0.1 ? "buy" : spreadPct < -0.1 ? "sell" : "neutral",
      exchangeId: eurExId,
    });
  }

  const brlExId = findExchangeId(exchanges, TOKENS.cUSD, TOKENS.cREAL);
  if (brlExId) {
    const amountOut = await pc.readContract({
      address: BROKER,
      abi: BROKER_ABI,
      functionName: "getAmountOut",
      args: [BIPOOL_MANAGER, brlExId, TOKENS.cUSD, TOKENS.cREAL, amountIn],
    });
    const mentoRate = Number(formatUnits(amountOut, 18));
    const spread = mentoRate - realBrlPerUsd;
    const spreadPct = (spread / realBrlPerUsd) * 100;
    rates.push({
      pair: "cUSD/cREAL",
      mentoRate: +mentoRate.toFixed(4),
      forexRate: +realBrlPerUsd.toFixed(4),
      spread: +spread.toFixed(4),
      spreadPct: +spreadPct.toFixed(3),
      direction:
        spreadPct > 0.1 ? "buy" : spreadPct < -0.1 ? "sell" : "neutral",
      exchangeId: brlExId,
    });
  }

  // 4. Generate signals
  const signals = rates.map((r) => ({
    id: `cron-${Date.now()}-${r.pair.replace("/", "-")}`,
    asset: r.pair,
    market: "mento",
    direction: r.direction,
    confidence: Math.min(95, Math.round(60 + Math.abs(r.spreadPct) * 30)),
    spreadPct: r.spreadPct,
    summary: `${r.pair}: Mento ${r.mentoRate} vs Forex ${r.forexRate} (${r.spreadPct > 0 ? "+" : ""}${r.spreadPct.toFixed(3)}% spread)`,
    timestamp: new Date().toISOString(),
  }));

  // 5. Autonomous execution — swap if spread exceeds threshold
  const swapResults: unknown[] = [];
  if (env.AGENT_PRIVATE_KEY) {
    for (const r of rates) {
      if (Math.abs(r.spreadPct) > SPREAD_THRESHOLD) {
        const [from, to] = r.pair.split("/").map((t) => t.replace("c", "c"));
        try {
          const result = await executeSwap(
            env,
            { from, to },
            r.exchangeId as `0x${string}`,
            pc
          );
          swapResults.push({
            pair: r.pair,
            spreadPct: r.spreadPct,
            ...result,
            timestamp: new Date().toISOString(),
          });
        } catch (err) {
          swapResults.push({
            pair: r.pair,
            success: false,
            error: err instanceof Error ? err.message.slice(0, 100) : "unknown",
          });
        }
      }
    }
  }

  const result = {
    timestamp: new Date().toISOString(),
    rates,
    signals,
    swaps: swapResults,
    scansTotal: 0,
  };

  // 6. Persist to KV
  await env.KV.put("latest_scan", JSON.stringify(result));

  // Scan history
  const historyRaw = await env.KV.get("scan_history");
  const history: unknown[] = historyRaw ? JSON.parse(historyRaw) : [];
  history.unshift({
    timestamp: result.timestamp,
    rates,
    signalCount: signals.length,
    swapCount: swapResults.filter((s: any) => s.success).length,
  });
  if (history.length > 100) history.length = 100;
  await env.KV.put("scan_history", JSON.stringify(history));

  // Scan count
  const countRaw = await env.KV.get("scan_count");
  const count = (countRaw ? parseInt(countRaw) : 0) + 1;
  await env.KV.put("scan_count", count.toString());
  result.scansTotal = count;

  // Signals
  const signalsRaw = await env.KV.get("signals");
  const allSignals: unknown[] = signalsRaw ? JSON.parse(signalsRaw) : [];
  allSignals.unshift(...signals);
  if (allSignals.length > 200) allSignals.length = 200;
  await env.KV.put("signals", JSON.stringify(allSignals));

  // Trades
  if (swapResults.length > 0) {
    const tradesRaw = await env.KV.get("trades");
    const allTrades: unknown[] = tradesRaw ? JSON.parse(tradesRaw) : [];
    allTrades.unshift(...swapResults.filter((s: any) => s.success));
    if (allTrades.length > 100) allTrades.length = 100;
    await env.KV.put("trades", JSON.stringify(allTrades));
  }

  return result;
}

// ─── Worker exports ───

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");

    if (request.method === "OPTIONS") {
      return cors({}, 200, origin);
    }

    switch (url.pathname) {
      case "/scan": {
        if (request.method !== "POST") return cors({ error: "POST only" }, 405, origin);
        // Require auth for manual scan trigger
        if (env.SCAN_SECRET) {
          const auth = request.headers.get("authorization");
          if (auth !== `Bearer ${env.SCAN_SECRET}`) {
            return cors({ error: "Unauthorized" }, 401, origin);
          }
        }
        const result = await scan(env);
        return cors(result, 200, origin);
      }

      case "/rates": {
        const data = await env.KV.get("latest_scan");
        return cors(data ? JSON.parse(data) : { error: "No scan data yet" }, 200, origin);
      }

      case "/signals": {
        const data = await env.KV.get("signals");
        return cors(data ? JSON.parse(data) : [], 200, origin);
      }

      case "/trades": {
        const data = await env.KV.get("trades");
        return cors(data ? JSON.parse(data) : [], 200, origin);
      }

      case "/history": {
        const data = await env.KV.get("scan_history");
        return cors(data ? JSON.parse(data) : [], 200, origin);
      }

      case "/stats": {
        const count = await env.KV.get("scan_count");
        const latest = await env.KV.get("latest_scan");
        const signalsRaw = await env.KV.get("signals");
        const tradesRaw = await env.KV.get("trades");
        return cors({
          totalScans: count ? parseInt(count) : 0,
          latestScan: latest
            ? (JSON.parse(latest) as { timestamp: string }).timestamp
            : null,
          totalSignals: signalsRaw ? JSON.parse(signalsRaw).length : 0,
          totalTrades: tradesRaw ? JSON.parse(tradesRaw).length : 0,
          spreadThreshold: `${SPREAD_THRESHOLD}%`,
          autonomousExecution: !!env.AGENT_PRIVATE_KEY,
        }, 200, origin);
      }

      default:
        return cors(
          {
            name: "CeloFX Agent Backend",
            description:
              "Autonomous FX arbitrage agent — scans Mento vs forex rates every 15 min, executes swaps when spread exceeds threshold",
            endpoints: [
              "GET  /rates    — latest Mento vs forex rates",
              "GET  /signals  — all generated signals",
              "GET  /trades   — autonomous swap executions",
              "GET  /history  — scan history",
              "GET  /stats    — scan count + execution stats",
              "POST /scan     — trigger manual scan + execute (auth required)",
            ],
            cron: "every 15 minutes",
            spreadThreshold: `${SPREAD_THRESHOLD}%`,
            autonomousExecution: !!env.AGENT_PRIVATE_KEY,
          },
          200,
          origin
        );
    }
  },

  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(scan(env));
  },
};
