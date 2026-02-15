import { createHmac } from "crypto";
import { createThirdwebClient } from "thirdweb";
import { privateKeyToAccount as thirdwebPrivateKeyToAccount } from "thirdweb/wallets";
import { privateKeyToAccount as viemPrivateKeyToAccount } from "viem/accounts";

function getWalletSecret(): string {
  const secret =
    process.env.USER_AGENT_WALLET_SECRET ||
    process.env.THIRDWEB_SECRET_KEY ||
    process.env.AGENT_PRIVATE_KEY;
  if (!secret) {
    throw new Error("Missing USER_AGENT_WALLET_SECRET (or THIRDWEB_SECRET_KEY/AGENT_PRIVATE_KEY fallback)");
  }
  return secret;
}

function getThirdwebClient() {
  const secretKey = process.env.THIRDWEB_SECRET_KEY;
  const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;
  if (secretKey) return createThirdwebClient({ secretKey });
  if (clientId) return createThirdwebClient({ clientId });
  // local-only fallback for deterministic address derivation
  return createThirdwebClient({ clientId: "local-dev" });
}

function deriveCandidatePrivateKey(userAddress: string, counter: number): `0x${string}` {
  const seed = `${userAddress.toLowerCase()}:${counter}`;
  const digest = createHmac("sha256", getWalletSecret()).update(seed).digest("hex");
  return `0x${digest}` as `0x${string}`;
}

export function deriveUserAgentWallet(userAddress: string): {
  address: `0x${string}`;
  privateKey: `0x${string}`;
  source: "thirdweb_deterministic";
} {
  const client = getThirdwebClient();
  for (let i = 0; i < 8; i++) {
    const candidate = deriveCandidatePrivateKey(userAddress, i);
    try {
      // Validate key with both SDKs; return consistent checksum address.
      const twAccount = thirdwebPrivateKeyToAccount({
        client,
        privateKey: candidate,
      });
      const viemAccount = viemPrivateKeyToAccount(candidate);
      if (twAccount.address.toLowerCase() === viemAccount.address.toLowerCase()) {
        return {
          address: viemAccount.address,
          privateKey: candidate,
          source: "thirdweb_deterministic",
        };
      }
    } catch {
      // try next counter
    }
  }
  throw new Error("Failed to derive user agent wallet");
}
