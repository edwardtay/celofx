import {
  createPublicClient,
  http,
  parseUnits,
  formatUnits,
  type Address,
} from "viem";
import { celo } from "viem/chains";

interface Env {
  KV: KVNamespace;
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

// ─── Helpers ───

function cors(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
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

// ─── Core scan logic ───

async function scan(env: Env) {
  const client = createPublicClient({
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
  const rawExchanges = await client.readContract({
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
  }> = [];

  const eurExId = findExchangeId(exchanges, TOKENS.cUSD, TOKENS.cEUR);
  if (eurExId) {
    const amountOut = await client.readContract({
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
    });
  }

  const brlExId = findExchangeId(exchanges, TOKENS.cUSD, TOKENS.cREAL);
  if (brlExId) {
    const amountOut = await client.readContract({
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
    });
  }

  // 4. Generate signals from spread data
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

  const result = {
    timestamp: new Date().toISOString(),
    rates,
    signals,
    scansTotal: 0,
  };

  // 5. Persist to KV
  await env.KV.put("latest_scan", JSON.stringify(result));

  // Append to scan history (keep last 100)
  const historyRaw = await env.KV.get("scan_history");
  const history: unknown[] = historyRaw ? JSON.parse(historyRaw) : [];
  history.unshift({
    timestamp: result.timestamp,
    rates,
    signalCount: signals.length,
  });
  if (history.length > 100) history.length = 100;
  await env.KV.put("scan_history", JSON.stringify(history));

  // Increment scan count
  const countRaw = await env.KV.get("scan_count");
  const count = (countRaw ? parseInt(countRaw) : 0) + 1;
  await env.KV.put("scan_count", count.toString());
  result.scansTotal = count;

  // Merge new signals into persistent signal store (keep last 200)
  const signalsRaw = await env.KV.get("signals");
  const allSignals: unknown[] = signalsRaw ? JSON.parse(signalsRaw) : [];
  allSignals.unshift(...signals);
  if (allSignals.length > 200) allSignals.length = 200;
  await env.KV.put("signals", JSON.stringify(allSignals));

  return result;
}

// ─── Worker exports ───

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return cors({});
    }

    switch (url.pathname) {
      case "/scan": {
        if (request.method !== "POST") return cors({ error: "POST only" }, 405);
        const result = await scan(env);
        return cors(result);
      }

      case "/rates": {
        const data = await env.KV.get("latest_scan");
        return cors(data ? JSON.parse(data) : { error: "No scan data yet" });
      }

      case "/signals": {
        const data = await env.KV.get("signals");
        return cors(data ? JSON.parse(data) : []);
      }

      case "/history": {
        const data = await env.KV.get("scan_history");
        return cors(data ? JSON.parse(data) : []);
      }

      case "/stats": {
        const count = await env.KV.get("scan_count");
        const latest = await env.KV.get("latest_scan");
        const signalsRaw = await env.KV.get("signals");
        return cors({
          totalScans: count ? parseInt(count) : 0,
          latestScan: latest
            ? (JSON.parse(latest) as { timestamp: string }).timestamp
            : null,
          totalSignals: signalsRaw ? JSON.parse(signalsRaw).length : 0,
        });
      }

      default:
        return cors(
          {
            name: "CeloFX Agent Backend",
            endpoints: [
              "GET  /rates    — latest Mento vs forex rates",
              "GET  /signals  — all generated signals",
              "GET  /history  — scan history",
              "GET  /stats    — scan count + stats",
              "POST /scan     — trigger manual scan",
            ],
            cron: "every 15 minutes",
          },
          200
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
