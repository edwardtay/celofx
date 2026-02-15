#!/usr/bin/env node
import process from "node:process";
import fs from "node:fs";
import path from "node:path";
import { createPublicClient, createWalletClient, encodeFunctionData, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

const CUSD = "0x765DE816845861e75A25fCA122bb6898B8B1282a";
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

const TRANSFER_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
];

function walletClient() {
  const pk = process.env.AGENT_PRIVATE_KEY;
  if (!pk) throw new Error("Missing AGENT_PRIVATE_KEY in frontend/.env.local");
  const key = pk.startsWith("0x") ? pk : `0x${pk}`;
  const account = privateKeyToAccount(key);
  return createWalletClient({ account, chain: celo, transport: http(FORNO) });
}

async function main() {
  const rootEnv = path.resolve(".env.local");
  const frontendEnv = path.resolve("frontend/.env.local");
  if (fs.existsSync(rootEnv)) loadEnv(rootEnv);
  if (fs.existsSync(frontendEnv)) loadEnv(frontendEnv);
  const [cmd, to, amountCusd] = process.argv.slice(2);
  if (cmd !== "transfer" || !to || !amountCusd) {
    console.log("Usage: node frontend/scripts/publisher-activity.mjs transfer <to> <amountCusd>");
    process.exit(1);
  }

  const wallet = walletClient();
  const publicClient = createPublicClient({ chain: celo, transport: http(FORNO) });
  const amount = parseUnits(amountCusd, 18);
  const data = encodeFunctionData({
    abi: TRANSFER_ABI,
    functionName: "transfer",
    args: [to, amount],
  });

  const hash = await wallet.sendTransaction({ to: CUSD, data, feeCurrency: CUSD });
  console.log(`Tx hash: ${hash}`);
  await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
  console.log(`Confirmed: https://celoscan.io/tx/${hash}`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
