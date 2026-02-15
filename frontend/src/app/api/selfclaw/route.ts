import { NextResponse } from "next/server";

const AGENT_ADDRESS = "0x6652AcDc623b7CCd52E115161d84b949bAf3a303";
const CANONICAL_AGENT_ID = 10;
const DEPRECATED_AGENT_IDS = [26];
const SELFCLAW_API = `https://selfclaw.ai/api/selfclaw/v1/agent/${AGENT_ADDRESS}`;

let cached: { data: Record<string, unknown>; timestamp: number } | null = null;
const CACHE_TTL = 5 * 60_000; // 5 min

export async function GET() {
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  const baseIdentity = {
    canonical: {
      agentId: CANONICAL_AGENT_ID,
      wallet: AGENT_ADDRESS,
      chainId: 42220,
      registryUrl: "https://www.8004scan.io/agents/celo/10",
    },
    deprecation: {
      deprecatedAgentIds: DEPRECATED_AGENT_IDS,
      message: "Agent #26 is deprecated. Use canonical agent #10.",
    },
  };

  try {
    const res = await fetch(SELFCLAW_API, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return NextResponse.json({
        verified: false,
        error: "API unreachable",
        ...baseIdentity,
      });
    }

    const raw = await res.json();
    const data = {
      ...raw,
      canonicalAgentId: CANONICAL_AGENT_ID,
      canonicalWallet: AGENT_ADDRESS,
      ...baseIdentity,
    };
    cached = { data, timestamp: Date.now() };
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({
      verified: false,
      error: "fetch failed",
      ...baseIdentity,
    });
  }
}
