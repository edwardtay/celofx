import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware: adds rate-limit headers to all /api/* responses.
 * CeloFX uses a 30-second cooldown per IP for the agent analyze endpoint,
 * and no limit on read-only endpoints. Headers communicate this clearly.
 */

const RATE_LIMIT_WINDOW_S = 30;
const RATE_LIMIT_MAX = 2; // requests per window for write endpoints

// Track request counts per IP (lightweight, resets on deploy)
const ipRequests = new Map<string, { count: number; resetAt: number }>();

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only apply to API routes
  if (!pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Math.floor(Date.now() / 1000);

  // Get or create rate limit entry
  let entry = ipRequests.get(ip);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_S };
    ipRequests.set(ip, entry);
  }
  entry.count++;

  // Cleanup stale entries periodically
  if (ipRequests.size > 200) {
    for (const [k, v] of ipRequests) {
      if (now >= v.resetAt) ipRequests.delete(k);
    }
  }

  const response = NextResponse.next();

  // Add rate limit headers to every API response
  response.headers.set("X-RateLimit-Limit", String(RATE_LIMIT_MAX));
  response.headers.set("X-RateLimit-Remaining", String(Math.max(0, RATE_LIMIT_MAX - entry.count)));
  response.headers.set("X-RateLimit-Reset", String(entry.resetAt));
  response.headers.set("X-RateLimit-Window", `${RATE_LIMIT_WINDOW_S}s`);

  // CORS for agent integrations
  response.headers.set("Access-Control-Expose-Headers", "X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-RateLimit-Window");

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
