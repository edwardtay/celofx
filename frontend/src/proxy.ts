import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware: adds rate-limit headers to all /api/* responses.
 * CeloFX uses a 30-second cooldown per IP for the agent analyze endpoint,
 * and no limit on read-only endpoints. Headers communicate this clearly.
 */

const RATE_LIMIT_WINDOW_S = 30;
const DEFAULT_WRITE_LIMIT = 2;

// Track request counts per IP (lightweight, resets on deploy)
const ipRequests = new Map<string, { writeCount: number; resetAt: number }>();

function getWriteRateConfig(pathname: string): { bucket: string; max: number } {
  if (pathname.startsWith("/api/orders")) {
    return { bucket: "orders", max: 8 };
  }
  if (pathname.startsWith("/api/remittance")) {
    return { bucket: "remittance", max: 6 };
  }
  if (pathname.startsWith("/api/swap/execute")) {
    return { bucket: "swap-exec", max: 6 };
  }
  return { bucket: "default", max: DEFAULT_WRITE_LIMIT };
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only apply to API routes
  if (!pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Math.floor(Date.now() / 1000);
  const isWrite = request.method !== "GET" && request.method !== "HEAD";
  const rateConfig = getWriteRateConfig(pathname);
  const rateKey = `${ip}:${rateConfig.bucket}`;

  // Get or create rate limit entry
  let entry = ipRequests.get(rateKey);
  if (!entry || now >= entry.resetAt) {
    entry = { writeCount: 0, resetAt: now + RATE_LIMIT_WINDOW_S };
    ipRequests.set(rateKey, entry);
  }
  if (isWrite) {
    entry.writeCount += 1;
  }

  // Cleanup stale entries periodically
  if (ipRequests.size > 200) {
    for (const [k, v] of ipRequests) {
      if (now >= v.resetAt) ipRequests.delete(k);
    }
  }

  const response = NextResponse.next();

  // Add rate limit headers to every API response
  response.headers.set("X-RateLimit-Limit", String(rateConfig.max));
  response.headers.set("X-RateLimit-Remaining", String(Math.max(0, rateConfig.max - entry.writeCount)));
  response.headers.set("X-RateLimit-Reset", String(entry.resetAt));
  response.headers.set("X-RateLimit-Window", `${RATE_LIMIT_WINDOW_S}s`);

  // CORS for agent integrations
  response.headers.set("Access-Control-Expose-Headers", "X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-RateLimit-Window");

  if (isWrite && entry.writeCount > rateConfig.max) {
    const retryAfter = Math.max(0, entry.resetAt - now);
    return new NextResponse(
      JSON.stringify({ error: "RATE_LIMITED", message: "Rate limited — wait before retrying" }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfter),
          "X-RateLimit-Limit": String(rateConfig.max),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(entry.resetAt),
          "X-RateLimit-Window": `${RATE_LIMIT_WINDOW_S}s`,
          "Access-Control-Expose-Headers": "X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-RateLimit-Window, Retry-After",
        },
      }
    );
  }

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
