/**
 * Submit on-chain feedback for $AAA agent on ERC-8004 Reputation Registry (Celo Mainnet)
 */

import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

const REPUTATION_REGISTRY = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" as const;
const AGENT_ID = 4n;
const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`;

const reputationAbi = [
  {
    type: "function",
    name: "giveFeedback",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "value", type: "int128" },
      { name: "valueDecimals", type: "uint8" },
      { name: "tag1", type: "string" },
      { name: "tag2", type: "string" },
      { name: "endpoint", type: "string" },
      { name: "feedbackURI", type: "string" },
      { name: "feedbackHash", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

const feedbacks = [
  { value: 90n, tag2: "BTC long call at 97k was spot on. Cross-market coverage is unmatched." },
  { value: 80n, tag2: "Forex signals consistently profitable. EUR/USD short was perfect timing." },
  { value: 85n, tag2: "Gold analysis caught the breakout. Commodity signals are underrated." },
];

async function main() {
  const privateKey = process.env.AGENT_PRIVATE_KEY;
  if (!privateKey) {
    console.error("Set AGENT_PRIVATE_KEY env var");
    process.exit(1);
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  console.log("Submitting feedback from:", account.address);

  const publicClient = createPublicClient({
    chain: celo,
    transport: http(),
  });

  const walletClient = createWalletClient({
    account,
    chain: celo,
    transport: http(),
  });

  for (const fb of feedbacks) {
    console.log(`\nSubmitting: ${fb.value}/100 — "${fb.tag2.slice(0, 50)}..."`);

    const hash = await walletClient.writeContract({
      address: REPUTATION_REGISTRY,
      abi: reputationAbi,
      functionName: "giveFeedback",
      args: [
        AGENT_ID,
        fb.value,
        0,
        "quality",
        fb.tag2,
        "https://aaa-agent-steel.vercel.app",
        "",
        ZERO_BYTES32,
      ],
    });

    console.log("Tx:", hash);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log("Status:", receipt.status, "Block:", receipt.blockNumber);
  }

  console.log("\nAll feedback submitted!");
}

main().catch(console.error);
