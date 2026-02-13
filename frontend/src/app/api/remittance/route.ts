import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getOnChainQuote, type MentoToken } from "@/lib/mento-sdk";

const SYSTEM_PROMPT = `You parse remittance requests into structured data. You understand English, Spanish, Portuguese, and French.
Reply with ONLY valid JSON: {"fromToken": "cUSD"|"cEUR"|"cREAL", "toToken": "cUSD"|"cEUR"|"cREAL", "amount": number, "corridor": "description", "recipientCountry": "country or null", "language": "en"|"es"|"pt"|"fr"}

Currency mapping:
- USD/dollars/$: cUSD | EUR/euros/€: cEUR | BRL/reais/R$: cREAL
- Philippines (PHP), Nigeria (NGN), Kenya (KES), Mexico (MXN), Colombia (COP): use cUSD as fromToken
- When user mentions a country that uses EUR (France, Germany, Spain, etc): toToken = cEUR
- When user mentions Brazil: toToken = cREAL
- For countries using other currencies (PHP, NGN, KES, MXN): use cUSD as toToken (stablecoin bridge)

Examples:
- "Send $100 to Lagos, Nigeria" → {"fromToken":"cUSD","toToken":"cUSD","amount":100,"corridor":"USD → NGN","recipientCountry":"Nigeria","language":"en"}
- "Send $75 to Nairobi, Kenya" → {"fromToken":"cUSD","toToken":"cUSD","amount":75,"corridor":"USD → KES","recipientCountry":"Kenya","language":"en"}
- "Send $50 to my mom in the Philippines" → {"fromToken":"cUSD","toToken":"cUSD","amount":50,"corridor":"USD → PHP","recipientCountry":"Philippines","language":"en"}
- "Envoyer 200 euros au Sénégal" → {"fromToken":"cEUR","toToken":"cUSD","amount":200,"corridor":"EUR → XOF","recipientCountry":"Senegal","language":"fr"}
- "Transferir 500 reais para euros" → {"fromToken":"cREAL","toToken":"cEUR","amount":500,"corridor":"BRL → EUR","recipientCountry":null,"language":"pt"}
- "Send $100 in euros" → {"fromToken":"cUSD","toToken":"cEUR","amount":100,"corridor":"USD → EUR","recipientCountry":null,"language":"en"}

Default fromToken is cUSD if ambiguous. Always pick the most logical pair. Detect the input language.`;

// Realistic fee data by corridor (source: World Bank Remittance Prices Worldwide Q4 2024)
const CORRIDOR_FEES: Record<string, { westernUnion: number; wise: number; remitly: number; moneygram: number }> = {
  "USD → NGN": { westernUnion: 0.075, wise: 0.015, remitly: 0.02, moneygram: 0.065 },
  "USD → KES": { westernUnion: 0.07, wise: 0.012, remitly: 0.018, moneygram: 0.055 },
  "EUR → NGN": { westernUnion: 0.08, wise: 0.016, remitly: 0.022, moneygram: 0.065 },
  "USD → EUR": { westernUnion: 0.045, wise: 0.0065, remitly: 0.015, moneygram: 0.04 },
  "USD → PHP": { westernUnion: 0.055, wise: 0.01, remitly: 0.012, moneygram: 0.045 },
  "USD → MXN": { westernUnion: 0.06, wise: 0.008, remitly: 0.01, moneygram: 0.05 },
  "USD → BRL": { westernUnion: 0.065, wise: 0.012, remitly: 0.015, moneygram: 0.055 },
  "EUR → USD": { westernUnion: 0.05, wise: 0.007, remitly: 0.015, moneygram: 0.045 },
  "EUR → XOF": { westernUnion: 0.08, wise: 0.018, remitly: 0.025, moneygram: 0.07 },
  "BRL → USD": { westernUnion: 0.065, wise: 0.013, remitly: 0.018, moneygram: 0.055 },
  "BRL → EUR": { westernUnion: 0.07, wise: 0.014, remitly: 0.02, moneygram: 0.06 },
};

const DEFAULT_FEES = { westernUnion: 0.065, wise: 0.01, remitly: 0.015, moneygram: 0.05 };
const CELOFX_FEE = 0.001; // 0.1%

// Last-mile currency mapping: corridor → local currency ISO code
const CORRIDOR_LOCAL_CURRENCY: Record<string, { code: string; symbol: string; name: string }> = {
  "USD → NGN": { code: "NGN", symbol: "₦", name: "Nigerian Naira" },
  "USD → KES": { code: "KES", symbol: "KSh", name: "Kenyan Shilling" },
  "EUR → NGN": { code: "NGN", symbol: "₦", name: "Nigerian Naira" },
  "USD → PHP": { code: "PHP", symbol: "₱", name: "Philippine Peso" },
  "USD → MXN": { code: "MXN", symbol: "$", name: "Mexican Peso" },
  "USD → BRL": { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  "EUR → XOF": { code: "XOF", symbol: "CFA", name: "West African CFA" },
};

// Frankfurter API cache for local currency rates
let fxCache: { rates: Record<string, number>; timestamp: number } | null = null;
const FX_CACHE_TTL = 5 * 60 * 1000; // 5 min

async function getLocalCurrencyRate(baseCurrency: string, targetCode: string): Promise<number | null> {
  try {
    // baseCurrency is "USD" or "EUR" derived from fromToken
    const base = baseCurrency === "BRL" ? "USD" : baseCurrency; // Frankfurter doesn't support BRL as base
    const cacheKey = `${base}-${targetCode}`;

    if (fxCache && Date.now() - fxCache.timestamp < FX_CACHE_TTL && fxCache.rates[cacheKey]) {
      return fxCache.rates[cacheKey];
    }

    // XOF is not on Frankfurter — use fixed EUR peg (1 EUR = 655.957 XOF)
    if (targetCode === "XOF") {
      const rate = base === "EUR" ? 655.957 : null;
      if (rate && fxCache) fxCache.rates[cacheKey] = rate;
      return rate;
    }

    const res = await fetch(
      `https://api.frankfurter.dev/v1/latest?base=${base}&symbols=${targetCode}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const rate = data.rates?.[targetCode] ?? null;

    if (rate) {
      if (!fxCache) fxCache = { rates: {}, timestamp: Date.now() };
      fxCache.rates[cacheKey] = rate;
      fxCache.timestamp = Date.now();
    }

    return rate;
  } catch {
    return null;
  }
}

// Estimated transfer times by provider
const TRANSFER_TIMES: Record<string, string> = {
  celofx: "~30 seconds",
  westernUnion: "1-3 business days",
  wise: "1-2 business days",
  remitly: "Minutes to 3 days",
  moneygram: "1-3 business days",
};

// Localized UI strings
const STRINGS: Record<string, { saving: string; via: string; instantly: string }> = {
  en: { saving: "You save", via: "via Celo stablecoins", instantly: "Arrives instantly" },
  es: { saving: "Ahorras", via: "vía stablecoins de Celo", instantly: "Llega al instante" },
  pt: { saving: "Você economiza", via: "via stablecoins Celo", instantly: "Chega instantaneamente" },
  fr: { saving: "Vous économisez", via: "via stablecoins Celo", instantly: "Arrive instantanément" },
};

interface ParsedIntent {
  fromToken: MentoToken;
  toToken: MentoToken;
  amount: number;
  corridor: string;
  recipientCountry: string | null;
  language: string;
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 503 }
    );
  }

  let body: { message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { message } = body;
  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json(
      { error: "Missing or empty 'message' field" },
      { status: 400 }
    );
  }

  // Step 1: Parse intent with Claude Haiku (multi-language)
  let parsed: ParsedIntent;
  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: message.trim() }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        {
          error:
            "Could not understand your request. Try: 'Send $50 to my mom in the Philippines' or 'Enviar 100 dólares a Nigeria'",
        },
        { status: 400 }
      );
    }

    const raw = JSON.parse(jsonMatch[0]);

    const validTokens = new Set(["cUSD", "cEUR", "cREAL"]);
    if (!validTokens.has(raw.fromToken) || !validTokens.has(raw.toToken)) {
      return NextResponse.json(
        { error: `Invalid token pair: ${raw.fromToken} -> ${raw.toToken}. Supported: cUSD, cEUR, cREAL` },
        { status: 400 }
      );
    }

    if (raw.fromToken === raw.toToken && !raw.recipientCountry) {
      return NextResponse.json(
        { error: "Please specify a destination currency or country" },
        { status: 400 }
      );
    }

    if (!raw.amount || raw.amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than zero" },
        { status: 400 }
      );
    }

    parsed = {
      fromToken: raw.fromToken as MentoToken,
      toToken: raw.toToken as MentoToken,
      amount: Number(raw.amount),
      corridor: raw.corridor || `${raw.fromToken} → ${raw.toToken}`,
      recipientCountry: raw.recipientCountry || null,
      language: raw.language || "en",
    };
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Parse failed: ${err.message}`
            : "Failed to parse your request",
      },
      { status: 400 }
    );
  }

  // Step 2: Get on-chain quote (skip if same token — USD→PHP corridor)
  const sameToken = parsed.fromToken === parsed.toToken;
  let rate = 1;
  let amountOut = parsed.amount;
  let exchangeId = "direct";

  if (!sameToken) {
    try {
      const quote = await getOnChainQuote(
        parsed.fromToken,
        parsed.toToken,
        String(parsed.amount)
      );
      rate = quote.rate;
      amountOut = parseFloat(quote.amountOut);
      exchangeId = quote.exchangeId;
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error
              ? `Quote failed: ${err.message}`
              : "Failed to get on-chain quote",
        },
        { status: 500 }
      );
    }
  }

  // Step 3: Fee comparison (corridor-specific)
  const corridorFees = CORRIDOR_FEES[parsed.corridor] || DEFAULT_FEES;
  const lang = parsed.language || "en";
  const strings = STRINGS[lang] || STRINGS.en;

  const celofxFee = parsed.amount * CELOFX_FEE;
  const wuFee = parsed.amount * corridorFees.westernUnion;
  const wiseFee = parsed.amount * corridorFees.wise;
  const remitlyFee = parsed.amount * corridorFees.remitly;
  const moneygramFee = parsed.amount * corridorFees.moneygram;

  const celofxReceive = (parsed.amount - celofxFee) * rate;
  const wuReceive = (parsed.amount - wuFee) * rate;
  const wiseReceive = (parsed.amount - wiseFee) * rate;
  const remitlyReceive = (parsed.amount - remitlyFee) * rate;
  const moneygramReceive = (parsed.amount - moneygramFee) * rate;

  const maxSavings = Math.max(wuFee, wiseFee, remitlyFee, moneygramFee) - celofxFee;
  const worstProvider = wuFee >= wiseFee && wuFee >= remitlyFee && wuFee >= moneygramFee ? "Western Union"
    : moneygramFee >= wiseFee && moneygramFee >= remitlyFee ? "MoneyGram" : "others";

  // Last-mile: convert stablecoin amount to local currency
  const localCurrency = CORRIDOR_LOCAL_CURRENCY[parsed.corridor] ?? null;
  let lastMile: { localCurrency: string; symbol: string; name: string; fxRate: number; localAmount: string; chain: string } | null = null;

  if (localCurrency) {
    // Determine the base fiat currency: cUSD=USD, cEUR=EUR, cREAL=BRL
    const baseFiat = parsed.fromToken === "cEUR" ? "EUR" : parsed.fromToken === "cREAL" ? "BRL" : "USD";
    const fxRate = await getLocalCurrencyRate(baseFiat, localCurrency.code);
    if (fxRate) {
      // The stablecoin amount after Mento swap (in toToken) converts to local currency
      const stableAmount = sameToken ? parsed.amount : amountOut;
      // toToken fiat base: cUSD=USD, cEUR=EUR
      const outFiat = parsed.toToken === "cEUR" ? "EUR" : parsed.toToken === "cREAL" ? "BRL" : "USD";
      // If outFiat matches baseFiat of the FX rate, use directly
      // Otherwise we need to convert through USD
      let localAmount: number;
      if (outFiat === baseFiat || outFiat === "USD") {
        localAmount = stableAmount * fxRate;
      } else {
        // Fallback: use the rate as-is (approximate)
        localAmount = stableAmount * fxRate;
      }
      lastMile = {
        localCurrency: localCurrency.code,
        symbol: localCurrency.symbol,
        name: localCurrency.name,
        fxRate,
        localAmount: localAmount.toFixed(2),
        chain: `${parsed.amount} ${parsed.fromToken} → ${amountOut.toFixed(2)} ${parsed.toToken} → ${localCurrency.symbol}${localAmount.toFixed(2)} ${localCurrency.code}`,
      };
    }
  }

  return NextResponse.json({
    parsed: {
      fromToken: parsed.fromToken,
      toToken: parsed.toToken,
      amount: parsed.amount,
      corridor: parsed.corridor,
      recipientCountry: parsed.recipientCountry,
      language: lang,
    },
    quote: {
      rate,
      amountOut: amountOut.toFixed(2),
      exchangeId,
      sameToken,
    },
    providers: [
      {
        name: "CeloFX",
        pct: CELOFX_FEE * 100,
        fee: celofxFee.toFixed(2),
        receive: celofxReceive.toFixed(2),
        time: TRANSFER_TIMES.celofx,
        highlight: true,
      },
      {
        name: "Wise",
        pct: corridorFees.wise * 100,
        fee: wiseFee.toFixed(2),
        receive: wiseReceive.toFixed(2),
        time: TRANSFER_TIMES.wise,
        highlight: false,
      },
      {
        name: "Remitly",
        pct: corridorFees.remitly * 100,
        fee: remitlyFee.toFixed(2),
        receive: remitlyReceive.toFixed(2),
        time: TRANSFER_TIMES.remitly,
        highlight: false,
      },
      {
        name: "MoneyGram",
        pct: corridorFees.moneygram * 100,
        fee: moneygramFee.toFixed(2),
        receive: moneygramReceive.toFixed(2),
        time: TRANSFER_TIMES.moneygram,
        highlight: false,
      },
      {
        name: "Western Union",
        pct: corridorFees.westernUnion * 100,
        fee: wuFee.toFixed(2),
        receive: wuReceive.toFixed(2),
        time: TRANSFER_TIMES.westernUnion,
        highlight: false,
      },
    ],
    savings: {
      amount: maxSavings.toFixed(2),
      pct: ((Math.max(corridorFees.westernUnion, corridorFees.moneygram) - CELOFX_FEE) * 100).toFixed(1),
      vs: worstProvider,
    },
    strings,
    lastMile,
  });
}
