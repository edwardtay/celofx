import { NextRequest, NextResponse } from "next/server";
import { getAttestation } from "@/lib/tee";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const teeAttestation = await getAttestation();

  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const agentSecret = process.env.AGENT_API_SECRET;
    if (agentSecret) {
      headers["Authorization"] = `Bearer ${agentSecret}`;
    }

    const res = await fetch(`${baseUrl}/api/agent/analyze`, {
      method: "POST",
      headers,
    });

    // Analyze endpoint returns SSE — read the stream and extract the final event
    if (!res.body) {
      return NextResponse.json({ error: "No response body" }, { status: 500 });
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalData: Record<string, unknown> | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop()!;

      for (const part of parts) {
        if (!part.trim()) continue;
        const lines = part.split("\n");
        let eventType = "";
        let dataStr = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) eventType = line.slice(7);
          else if (line.startsWith("data: ")) dataStr = line.slice(6);
        }
        if (eventType === "complete" && dataStr) {
          try { finalData = JSON.parse(dataStr); } catch { /* skip */ }
        }
        if (eventType === "error" && dataStr) {
          try { finalData = JSON.parse(dataStr); } catch { /* skip */ }
        }
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      tee: {
        status: teeAttestation.status,
        verified: teeAttestation.verified,
        timestamp: teeAttestation.timestamp,
      },
      ...(finalData ?? {}),
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Cron scan failed: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 500 }
    );
  }
}
