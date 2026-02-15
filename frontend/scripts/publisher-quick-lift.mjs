#!/usr/bin/env node
/**
 * Publisher score quick-lift executor for 8004scan.
 *
 * Usage:
 *   node scripts/publisher-quick-lift.mjs run --to 0x... --amount 0.25 --delaySec 600
 *   node scripts/publisher-quick-lift.mjs dry-run --to 0x... --amount 0.25
 */

import { createPublicClient, createWalletClient, encodeFunctionData, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import fs from "node:fs";
import path from "node:path";

const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const AGENT_ID = 10n;
const AGENT_WALLET = "0x6652AcDc623b7CCd52E115161d84b949bAf3a303";
const CUSD = "0x765DE816845861e75A25fCA122bb6898B8B1282a";
const FORNO = "https://forno.celo.org";

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

const SET_AGENT_WALLET_ABI = [
  {
    name: "setAgentWallet",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "wallet", type: "address" },
    ],
    outputs: [],
  },
];

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
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function parseArg(flag, fallback) {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  return process.argv[idx + 1] ?? fallback;
}

function isAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function getWalletClient() {
  const pk = process.env.AGENT_PRIVATE_KEY;
  if (!pk) throw new Error("Missing AGENT_PRIVATE_KEY in frontend/.env.local");
  const account = privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`));
  return createWalletClient({ account, chain: celo, transport: http(FORNO) });
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function run(mode) {
  loadEnv(path.resolve("frontend/.env.local"));

  const to = parseArg("--to");
  const amount = parseArg("--amount", "0.25");
  const delaySec = Number(parseArg("--delaySec", "600"));

  if (!to || !isAddress(to)) {
    throw new Error("Provide valid --to 0x... address");
  }
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    throw new Error("Provide valid --amount (e.g. 0.25)");
  }
  if (!Number.isFinite(delaySec) || delaySec < 0) {
    throw new Error("Provide valid --delaySec >= 0");
  }

  console.log("Publisher quick-lift plan");
  console.log(`- recipient: ${to}`);
  console.log(`- transfer amount: ${amount} cUSD`);
  console.log(`- spacing: ${delaySec}s`);
  console.log("- expected tx count: 3");
  console.log("- tx1: cUSD transfer to external wallet");
  console.log("- tx2: setAgentWallet(agentId=10, same wallet) contract write");
  console.log("- tx3: cUSD transfer to external wallet");

  if (mode === "dry-run") {
    console.log("\nDry run only. No transaction sent.");
    return;
  }

  const wallet = getWalletClient();
  const client = createPublicClient({ chain: celo, transport: http(FORNO) });
  const amountWei = parseUnits(amount, 18);

  const transferData = encodeFunctionData({
    abi: TRANSFER_ABI,
    functionName: "transfer",
    args: [to, amountWei],
  });

  const setWalletData = encodeFunctionData({
    abi: SET_AGENT_WALLET_ABI,
    functionName: "setAgentWallet",
    args: [AGENT_ID, AGENT_WALLET],
  });

  console.log("\nSending tx1/3: transfer");
  const tx1 = await wallet.sendTransaction({ to: CUSD, data: transferData, feeCurrency: CUSD });
  await client.waitForTransactionReceipt({ hash: tx1, timeout: 120_000 });
  console.log(`Confirmed: https://celoscan.io/tx/${tx1}`);

  if (delaySec > 0) {
    console.log(`\nWaiting ${delaySec}s before tx2...`);
    await sleep(delaySec * 1000);
  }

  console.log("\nSending tx2/3: setAgentWallet");
  const tx2 = await wallet.sendTransaction({ to: IDENTITY_REGISTRY, data: setWalletData, feeCurrency: CUSD });
  await client.waitForTransactionReceipt({ hash: tx2, timeout: 120_000 });
  console.log(`Confirmed: https://celoscan.io/tx/${tx2}`);

  if (delaySec > 0) {
    console.log(`\nWaiting ${delaySec}s before tx3...`);
    await sleep(delaySec * 1000);
  }

  console.log("\nSending tx3/3: transfer");
  const tx3 = await wallet.sendTransaction({ to: CUSD, data: transferData, feeCurrency: CUSD });
  await client.waitForTransactionReceipt({ hash: tx3, timeout: 120_000 });
  console.log(`Confirmed: https://celoscan.io/tx/${tx3}`);

  console.log("\nDone. Check score refresh:");
  console.log("- https://www.8004scan.io/api/v1/agents/scores/v5/42220/10");
}

const cmd = process.argv[2];
if (cmd === "run") {
  run("run").catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
} else if (cmd === "dry-run") {
  run("dry-run").catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
} else {
  console.log("Usage:");
  console.log("  node scripts/publisher-quick-lift.mjs run --to 0x... --amount 0.25 --delaySec 600");
  console.log("  node scripts/publisher-quick-lift.mjs dry-run --to 0x... --amount 0.25");
  process.exit(1);
}
