/**
 * Register $AAA agent on ERC-8004 Identity Registry (Celo Mainnet)
 *
 * Usage:
 *   AGENT_PRIVATE_KEY=0x... npx tsx scripts/register-agent.ts
 *
 * Prerequisites:
 *   - AGENT_PRIVATE_KEY with CELO for gas on mainnet
 */

import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const;

const identityRegistryAbi = [
  {
    type: "function",
    name: "register",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "Registered",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "agentURI", type: "string", indexed: false },
      { name: "owner", type: "address", indexed: true },
    ],
  },
] as const;

async function main() {
  const privateKey = process.env.AGENT_PRIVATE_KEY;
  if (!privateKey) {
    console.error("Set AGENT_PRIVATE_KEY env var");
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  console.log("Registering agent from:", account.address);

  const publicClient = createPublicClient({
    chain: celo,
    transport: http(),
  });

  const walletClient = createWalletClient({
    account,
    chain: celo,
    transport: http(),
  });

  // Agent metadata URI — use the Vercel-hosted file
  const agentURI = "https://celofx.vercel.app/agent-metadata.json";

  console.log("Agent URI:", agentURI);
  console.log("Sending registration tx...");

  const hash = await walletClient.writeContract({
    address: IDENTITY_REGISTRY,
    abi: identityRegistryAbi,
    functionName: "register",
    args: [agentURI],
  });

  console.log("Tx hash:", hash);
  console.log("Waiting for confirmation...");

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("Status:", receipt.status);
  console.log("Block:", receipt.blockNumber);

  // Parse Registered event to get agentId
  if (receipt.logs.length > 0) {
    const log = receipt.logs[0];
    if (log.topics[1]) {
      const agentId = BigInt(log.topics[1]);
      console.log("\nAgent registered successfully!");
      console.log("Agent ID:", agentId.toString());
      console.log("\nSet in .env.local:");
      console.log(`NEXT_PUBLIC_AGENT_ID=${agentId.toString()}`);
      console.log(
        `\nView on Celoscan: https://celoscan.io/tx/${hash}`
      );
    }
  }
}

main().catch(console.error);
