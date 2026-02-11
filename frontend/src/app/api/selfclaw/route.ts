import { NextResponse } from "next/server";

const AGENT_ADDRESS = "0x6652AcDc623b7CCd52E115161d84b949bAf3a303";
const SELFCLAW_API = `https://selfclaw.ai/api/selfclaw/v1/agent/${AGENT_ADDRESS}`;

let cached: { data: Record<string, unknown>; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60_000; // 5 min

export async function GET() {
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    const res = await fetch(SELFCLAW_API, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return NextResponse.json({ verified: false, error: "API unreachable" });
    }

    const data = await res.json();
    cached = { data, timestamp: Date.now() };
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ verified: false, error: "fetch failed" });
  }
}
