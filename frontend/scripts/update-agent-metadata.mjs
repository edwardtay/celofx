#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createPublicClient, createWalletClient, encodeFunctionData, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const CUSD = "0x765DE816845861e75A25fCA122bb6898B8B1282a";
const AGENT_ID = 10n;
const FORNO = "https://forno.celo.org";

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

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
];

function buildDataUri(payload) {
  return `data:application/json;base64,${Buffer.from(JSON.stringify(payload), "utf8").toString("base64")}`;
}

function getWalletClient() {
  const pk = process.env.AGENT_PRIVATE_KEY;
  if (!pk) throw new Error("Missing AGENT_PRIVATE_KEY in frontend/.env.local");
  const key = pk.startsWith("0x") ? pk : `0x${pk}`;
  const account = privateKeyToAccount(key);
  return createWalletClient({ account, chain: celo, transport: http(FORNO) });
}

async function main() {
  loadEnv(path.resolve("frontend/.env.local"));
  const dryRun = process.argv.includes("--dry-run");
  const metadataPath = path.resolve("frontend/public/agent-metadata.json");
  const payload = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  payload.updatedAt = new Date().toISOString();
  const dataUri = buildDataUri(payload);

  console.log(`Agent ID: ${AGENT_ID}`);
  console.log(`Data URI length: ${dataUri.length}`);

  if (dryRun) {
    console.log("Dry run complete. No transaction sent.");
    return;
  }

  const wallet = getWalletClient();
  const publicClient = createPublicClient({ chain: celo, transport: http(FORNO) });
  const data = encodeFunctionData({
    abi: SET_AGENT_URI_ABI,
    functionName: "setAgentURI",
    args: [AGENT_ID, dataUri],
  });

  const hash = await wallet.sendTransaction({
    to: IDENTITY_REGISTRY,
    data,
    feeCurrency: CUSD,
  });
  console.log(`Tx hash: ${hash}`);
  await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
  console.log(`Confirmed: https://celoscan.io/tx/${hash}`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
