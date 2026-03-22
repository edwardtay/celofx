import { NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 30;

/**
 * Venice AI private analysis endpoint.
 * Uses Venice's zero-retention inference for privacy-preserving market analysis.
 * No data stored, no logs, no training — private cognition for public actions.
 */
export async function POST(request: Request) {
  const apiKey = process.env.VENICE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "VENICE_API_KEY not configured" }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const query = body.query || "Analyze current Mento stablecoin rates and identify any FX arbitrage opportunities on Celo.";

  const client = new OpenAI({ apiKey, baseURL: "https://api.venice.ai/api/v1" });

  try {
    // Fetch live market data to give Venice context
    const [mentoRes, forexRes] = await Promise.all([
      fetch(`${process.env.APP_URL || "https://celofx.lever-labs.com"}/api/market-data/mento`).then(r => r.json()).catch(() => []),
      fetch(`${process.env.APP_URL || "https://celofx.lever-labs.com"}/api/market-data/forex`).then(r => r.json()).catch(() => []),
    ]);

    const response = await client.chat.completions.create({
      model: "llama-3.3-70b",
      max_tokens: 1024,
      messages: [
        {
          role: "system",
          content: `You are CeloFX, an autonomous FX arbitrage agent on Celo. You analyze stablecoin rates privately using Venice AI's zero-retention inference. Your analysis drives on-chain trading decisions. Be concise and data-driven.

Current market data:
Mento rates: ${JSON.stringify(mentoRes).slice(0, 500)}
Forex rates: ${JSON.stringify(forexRes).slice(0, 300)}`,
        },
        { role: "user", content: query },
      ],
    });

    const analysis = response.choices[0]?.message?.content || "";

    return NextResponse.json({
      analysis,
      model: "llama-3.3-70b",
      provider: "venice-ai",
      privacy: {
        zeroRetention: true,
        noLogging: true,
        noTraining: true,
        inference: "private",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Venice analysis failed: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 500 }
    );
  }
}
