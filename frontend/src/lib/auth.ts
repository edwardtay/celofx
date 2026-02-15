import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

const AUTH_HEADER = "authorization";
const SIGNATURE_HEADER = "x-agent-signature";
const TIMESTAMP_HEADER = "x-agent-timestamp";
const NONCE_HEADER = "x-agent-nonce";
const MAX_SKEW_MS = 5 * 60 * 1000;
const NONCE_TTL_MS = 10 * 60 * 1000;
const nonceCache = new Map<string, number>();

export function hasAgentSecret(): boolean {
  return Boolean(process.env.AGENT_API_SECRET);
}

export function verifyBearerAuth(request: Request): boolean {
  const secret = process.env.AGENT_API_SECRET;
  if (!secret) return false;
  const auth = request.headers.get(AUTH_HEADER);
  return auth === `Bearer ${secret}`;
}

function cleanupNonces(now: number) {
  if (nonceCache.size < 1000) return;
  for (const [nonce, ts] of nonceCache) {
    if (now - ts > NONCE_TTL_MS) nonceCache.delete(nonce);
  }
}

export async function verifyHmacSignature(request: Request): Promise<boolean> {
  const secret = process.env.AGENT_API_SECRET;
  if (!secret) return false;

  const signature = request.headers.get(SIGNATURE_HEADER);
  const timestampRaw = request.headers.get(TIMESTAMP_HEADER);
  const nonce = request.headers.get(NONCE_HEADER);
  if (!signature || !timestampRaw || !nonce) return false;

  const timestamp = Number(timestampRaw);
  if (!Number.isFinite(timestamp)) return false;
  const now = Date.now();
  if (Math.abs(now - timestamp) > MAX_SKEW_MS) return false;

  cleanupNonces(now);
  const lastSeen = nonceCache.get(nonce);
  if (lastSeen && now - lastSeen < NONCE_TTL_MS) return false;

  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const body = await request.clone().text();
  const payload = `${timestamp}.${nonce}.${method}.${url.pathname}.${body}`;
  const digest = createHmac("sha256", secret).update(payload).digest("hex");

  const sigBuf = Buffer.from(signature, "hex");
  const digBuf = Buffer.from(digest, "hex");
  if (sigBuf.length !== digBuf.length) return false;
  const ok = timingSafeEqual(sigBuf, digBuf);
  if (ok) {
    nonceCache.set(nonce, now);
  }
  return ok;
}

export async function requireSignedAuth(request: Request) {
  if (await verifyHmacSignature(request)) {
    return { ok: true, via: "hmac" } as const;
  }
  if (process.env.AGENT_API_ALLOW_BEARER === "true" && verifyBearerAuth(request)) {
    return { ok: true, via: "bearer" } as const;
  }
  return { ok: false } as const;
}

export function requireBearerAuth(request: Request, opts?: { allowPublic?: boolean }) {
  if (verifyBearerAuth(request)) {
    return { ok: true } as const;
  }

  if (opts?.allowPublic) {
    return { ok: true, public: true } as const;
  }

  return { ok: false } as const;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function missingSecretResponse() {
  return NextResponse.json(
    { error: "AGENT_API_SECRET not configured" },
    { status: 503 }
  );
}
