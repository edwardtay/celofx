const DEFAULT_NONCE_TTL_MS = 10 * 60 * 1000;
const MAX_LOCAL_NONCES = 5000;

const localNonceCache = new Map<string, number>();
let lastLocalCleanupMs = 0;

function cleanupLocal(now: number) {
  if (now - lastLocalCleanupMs < 30_000 && localNonceCache.size < MAX_LOCAL_NONCES) return;
  lastLocalCleanupMs = now;

  for (const [key, ts] of localNonceCache) {
    if (now - ts > DEFAULT_NONCE_TTL_MS) {
      localNonceCache.delete(key);
    }
  }

  if (localNonceCache.size > MAX_LOCAL_NONCES) {
    const ordered = [...localNonceCache.entries()].sort((a, b) => a[1] - b[1]);
    const removeCount = localNonceCache.size - MAX_LOCAL_NONCES;
    for (let i = 0; i < removeCount; i += 1) {
      const entry = ordered[i];
      if (!entry) break;
      localNonceCache.delete(entry[0]);
    }
  }
}

function consumeLocalNonce(key: string, now: number, ttlMs: number): boolean {
  cleanupLocal(now);
  const seenAt = localNonceCache.get(key);
  if (seenAt && now - seenAt < ttlMs) {
    return false;
  }
  localNonceCache.set(key, now);
  return true;
}

function getRemoteConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token };
}

async function consumeRemoteNonce(key: string, ttlMs: number): Promise<boolean | null> {
  const config = getRemoteConfig();
  if (!config) return null;

  try {
    const endpoint = `${config.url}/set/${encodeURIComponent(key)}/1?NX=true&PX=${ttlMs}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: string | null };
    return json.result === "OK";
  } catch {
    return null;
  }
}

export async function consumeNonce(params: {
  scope: string;
  key: string;
  timestamp: number;
  ttlMs?: number;
}): Promise<boolean> {
  const now = Date.now();
  const ttlMs = params.ttlMs ?? DEFAULT_NONCE_TTL_MS;
  if (!Number.isFinite(params.timestamp) || Math.abs(now - params.timestamp) > ttlMs) {
    return false;
  }

  const scopedKey = `nonce:${params.scope}:${params.key}`;
  const remote = await consumeRemoteNonce(scopedKey, ttlMs);
  if (remote !== null) return remote;
  return consumeLocalNonce(scopedKey, now, ttlMs);
}
