/**
 * Update ERC-8004 Agent #10 agentURI to a data URI (immutable, content-addressed)
 *
 * Fixes WA040: "HTTP/HTTPS URI is not content-addressed"
 * The data URI embeds the metadata directly — it cannot be changed without detection.
 *
 * Usage:
 *   AGENT_PRIVATE_KEY=0x... npx tsx scripts/update-uri-data.ts
 */

import { createWalletClient, createPublicClient, http, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { readFileSync } from "fs";
import { resolve } from "path";

const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const;
const AGENT_ID = 10n;
const CUSD = "0x765DE816845861e75A25fCA122bb6898B8B1282a" as `0x${string}`;

const identityRegistryAbi = [
  {
    type: "function",
    name: "setAgentURI",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "newURI", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "tokenURI",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
] as const;

async function main() {
  const privateKey = process.env.AGENT_PRIVATE_KEY;
  if (!privateKey) {
    console.error("Set AGENT_PRIVATE_KEY env var");
    process.exit(1);
  }

  const account = privateKeyToAccount(
    (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as `0x${string}`
  );

  const publicClient = createPublicClient({
    chain: celo,
    transport: http("https://forno.celo.org"),
  });

  const wallet = createWalletClient({
    account,
    chain: celo,
    transport: http("https://forno.celo.org"),
  });

  console.log("Wallet:", account.address);

  // Read current URI
  const currentURI = await publicClient.readContract({
    address: IDENTITY_REGISTRY,
    abi: identityRegistryAbi,
    functionName: "tokenURI",
    args: [AGENT_ID],
  });
  console.log("Current URI:", currentURI.slice(0, 80) + "...");

  // Read and minify the metadata JSON
  const metadataPath = resolve(__dirname, "../frontend/public/agent-metadata.json");
  const metadata = JSON.parse(readFileSync(metadataPath, "utf-8"));
  const minified = JSON.stringify(metadata);
  console.log("Metadata size:", minified.length, "bytes");

  // Encode as base64 data URI
  const base64 = Buffer.from(minified).toString("base64");
  const dataURI = `data:application/json;base64,${base64}`;
  console.log("Data URI size:", dataURI.length, "chars");

  // Estimate calldata cost
  const calldataBytes = new TextEncoder().encode(dataURI).length;
  console.log(`Estimated calldata: ~${calldataBytes} bytes (~${Math.ceil(calldataBytes * 16 / 1000)}K gas for calldata)`);

  console.log("\nUpdating on-chain agentURI to data URI...");

  const data = encodeFunctionData({
    abi: identityRegistryAbi,
    functionName: "setAgentURI",
    args: [AGENT_ID, dataURI],
  });

  const hash = await wallet.sendTransaction({
    to: IDENTITY_REGISTRY,
    data,
    feeCurrency: CUSD,
  });

  console.log("Tx hash:", hash);
  console.log("Waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("Status:", receipt.status);
  console.log("Gas used:", receipt.gasUsed.toString());

  // Verify
  const newURI = await publicClient.readContract({
    address: IDENTITY_REGISTRY,
    abi: identityRegistryAbi,
    functionName: "tokenURI",
    args: [AGENT_ID],
  });
  console.log("\nNew URI starts with:", newURI.slice(0, 40) + "...");
  console.log("Is data URI:", newURI.startsWith("data:"));

  console.log("\nAgent #10 URI updated to immutable data URI!");
  console.log("WA040 warning should be resolved.");
  console.log(`View: https://celoscan.io/tx/${hash}`);
  console.log("Check: https://8004scan.io/agents/celo/10?tab=metadata");
}

main().catch(console.error);
