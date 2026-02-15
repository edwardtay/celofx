/**
 * Update ERC-8004 off-chain metadata payload on-chain via setAgentURI.
 *
 * Usage:
 *   npx tsx scripts/update-agent-metadata.ts --dry-run
 *   npx tsx scripts/update-agent-metadata.ts
 *
 * Requires:
 *   AGENT_PRIVATE_KEY in frontend/.env.local (owner of agent #10)
 */

import { createPublicClient, createWalletClient, encodeFunctionData, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const;
const CUSD = "0x765DE816845861e75A25fCA122bb6898B8B1282a" as Address;
const AGENT_ID = 10n;
const FORNO = "https://forno.celo.org";

const SET_AGENT_URI_ABI = [
  {
    name: "setAgentURI",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "newURI", type: "string" },
    ],
    outputs: [],
  },
] as const;

function getOwnerWalletClient() {
  const pk = process.env.AGENT_PRIVATE_KEY;
  if (!pk) throw new Error("Missing AGENT_PRIVATE_KEY in frontend/.env.local");
  const key = (pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`;
  const account = privateKeyToAccount(key);
  return createWalletClient({ account, chain: celo, transport: http(FORNO) });
}

function buildDataUri(payload: unknown): string {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json, "utf8").toString("base64");
  return `data:application/json;base64,${b64}`;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const metadataPath = path.resolve(__dirname, "../public/agent-metadata.json");
  const raw = fs.readFileSync(metadataPath, "utf8");
  const payload = JSON.parse(raw) as Record<string, unknown>;

  payload.updatedAt = new Date().toISOString();
  const dataUri = buildDataUri(payload);

  console.log(`Agent ID: ${AGENT_ID.toString()}`);
  console.log(`Metadata path: ${metadataPath}`);
  console.log(`Data URI length: ${dataUri.length}`);

  if (dryRun) {
    console.log("\nDry run complete. No transaction submitted.");
    return;
  }

  const walletClient = getOwnerWalletClient();
  const publicClient = createPublicClient({ chain: celo, transport: http(FORNO) });
  const data = encodeFunctionData({
    abi: SET_AGENT_URI_ABI,
    functionName: "setAgentURI",
    args: [AGENT_ID, dataUri],
  });

  console.log("\nSubmitting setAgentURI transaction...");
  const hash = await walletClient.sendTransaction({
    to: IDENTITY_REGISTRY,
    data,
    feeCurrency: CUSD,
  });
  console.log(`Tx hash: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
  console.log(`Confirmed in block ${receipt.blockNumber}`);
  console.log(`Celoscan: https://celoscan.io/tx/${hash}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

