import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getOnChainQuote, type MentoToken, TOKENS } from "@/lib/mento-sdk";

const SYSTEM_PROMPT = `You parse remittance requests into structured data. Extract the swap details from natural language.
Reply with ONLY valid JSON: {"fromToken": "cUSD"|"cEUR"|"cREAL", "toToken": "cUSD"|"cEUR"|"cREAL", "amount": number, "corridor": "description"}
Examples:
- "Send $50 in euros" → {"fromToken":"cUSD","toToken":"cEUR","amount":50,"corridor":"USD → EUR"}
- "Convert 200 reais to dollars" → {"fromToken":"cREAL","toToken":"cUSD","amount":200,"corridor":"BRL → USD"}
- "I need 100 euros" → {"fromToken":"cUSD","toToken":"cEUR","amount":100,"corridor":"USD → EUR"}
- "Send USD to BRL" → {"fromToken":"cUSD","toToken":"cREAL","amount":100,"corridor":"USD → BRL"}
- "50 euros to reais" → {"fromToken":"cEUR","toToken":"cREAL","amount":50,"corridor":"EUR → BRL"}
Default fromToken is cUSD if ambiguous. Always pick the most logical pair.`;

// Hardcoded realistic fee percentages
const FEES = {
  celofx: 0.001, // 0.1% — Mento protocol fee only
  westernUnion: 0.065, // 6.5% — typical cross-border
  wise: 0.01, // 1.0% — typical Wise fee
};

interface ParsedIntent {
  fromToken: MentoToken;
  toToken: MentoToken;
  amount: number;
  corridor: string;
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

  // Step 1: Parse intent with Claude Haiku
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

    // Extract JSON from the response (handle potential markdown wrapping)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        {
          error:
            "Could not understand your request. Try something like: 'Send $50 in EUR' or 'Convert 100 cUSD to cREAL'",
        },
        { status: 400 }
      );
    }

    const raw = JSON.parse(jsonMatch[0]);

    // Validate tokens
    const validTokens = new Set(["cUSD", "cEUR", "cREAL"]);
    if (!validTokens.has(raw.fromToken) || !validTokens.has(raw.toToken)) {
      return NextResponse.json(
        {
          error: `Invalid token pair: ${raw.fromToken} -> ${raw.toToken}. Supported: cUSD, cEUR, cREAL`,
        },
        { status: 400 }
      );
    }

    if (raw.fromToken === raw.toToken) {
      return NextResponse.json(
        { error: "Source and destination tokens must be different" },
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
      corridor: raw.corridor || `${raw.fromToken} -> ${raw.toToken}`,
    };
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Parse failed: ${err.message}`
            : "Failed to parse your request. Try: 'Send $50 in EUR'",
      },
      { status: 400 }
    );
  }

  // Step 2: Get on-chain quote from Mento Broker
  try {
    const quote = await getOnChainQuote(
      parsed.fromToken,
      parsed.toToken,
      String(parsed.amount)
    );

    const amountOut = parseFloat(quote.amountOut);
    const rate = quote.rate;

    // Step 3: Calculate fee comparison
    const celofxFee = parsed.amount * FEES.celofx;
    const westernUnionFee = parsed.amount * FEES.westernUnion;
    const wiseFee = parsed.amount * FEES.wise;

    // Amount received after fees (apply fee to input, then convert at rate)
    const celofxReceive = (parsed.amount - celofxFee) * rate;
    const westernUnionReceive = (parsed.amount - westernUnionFee) * rate;
    const wiseReceive = (parsed.amount - wiseFee) * rate;

    const savings = westernUnionFee - celofxFee;

    return NextResponse.json({
      parsed: {
        fromToken: parsed.fromToken,
        toToken: parsed.toToken,
        amount: parsed.amount,
        corridor: parsed.corridor,
      },
      quote: {
        rate,
        amountOut: amountOut.toFixed(2),
        exchangeId: quote.exchangeId,
      },
      fees: {
        celofx: {
          pct: FEES.celofx * 100,
          fee: celofxFee.toFixed(2),
          receive: celofxReceive.toFixed(2),
        },
        westernUnion: {
          pct: FEES.westernUnion * 100,
          fee: westernUnionFee.toFixed(2),
          receive: westernUnionReceive.toFixed(2),
        },
        wise: {
          pct: FEES.wise * 100,
          fee: wiseFee.toFixed(2),
          receive: wiseReceive.toFixed(2),
        },
        savings: savings.toFixed(2),
        savingsPct: ((FEES.westernUnion - FEES.celofx) * 100).toFixed(1),
      },
    });
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
