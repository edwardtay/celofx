import { consumeNonce } from "@/lib/nonce-store";

const NONCE_TTL_MS = 10 * 60 * 1000;

export async function consumeEoaNonce(params: {
  scope: string;
  signer: string;
  nonce: string;
  timestamp: number;
}): Promise<boolean> {
  const normalizedNonce = params.nonce.trim();
  if (!normalizedNonce || normalizedNonce.length > 128) {
    return false;
  }

  return consumeNonce({
    scope: params.scope,
    key: `${params.signer.toLowerCase()}:${normalizedNonce}`,
    timestamp: params.timestamp,
    ttlMs: NONCE_TTL_MS,
  });
}
