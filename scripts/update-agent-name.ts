/**
 * Update ERC-8004 Agent #4 metadata to "CeloFX"
 *
 * Calls setAgentURI() with a data URI containing the new metadata JSON.
 *
 * Usage:
 *   AGENT_PRIVATE_KEY=0x... npx tsx scripts/update-agent-name.ts
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  encodeFunctionData,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

const IDENTITY_REGISTRY =
  "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const;
const AGENT_ID = 4n;
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

  // Check balances
  const celoBalance = await publicClient.getBalance({ address: account.address });
  console.log("CELO balance:", (Number(celoBalance) / 1e18).toFixed(4));

  // Read current URI
  const currentURI = await publicClient.readContract({
    address: IDENTITY_REGISTRY,
    abi: identityRegistryAbi,
    functionName: "tokenURI",
    args: [AGENT_ID],
  });
  console.log("Current URI:", currentURI.slice(0, 80) + "...");

  // Use HTTPS URL — much shorter calldata than a data URI
  const newURI = "https://celofx.vercel.app/agent-metadata.json";

  console.log("\nNew URI:", newURI);
  console.log("Calling setAgentURI...");

  // Encode calldata manually so we can use sendTransaction with feeCurrency
  const data = encodeFunctionData({
    abi: identityRegistryAbi,
    functionName: "setAgentURI",
    args: [AGENT_ID, newURI],
  });

  // Fee abstraction: pay gas in cUSD (CIP-64) since CELO balance is low
  const hash = await wallet.sendTransaction({
    to: IDENTITY_REGISTRY,
    data,
    feeCurrency: CUSD,
  });

  console.log("Tx hash:", hash);
  console.log("Waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("Status:", receipt.status);
  console.log("\nAgent #4 name updated to 'CeloFX'!");
  console.log(`View: https://celoscan.io/tx/${hash}`);
  console.log("Check: https://8004scan.io/agents/celo/4");
}

main().catch(console.error);
