/**
 * Fund a second wallet and submit on-chain feedback from it
 */

import { createWalletClient, createPublicClient, http, parseEther } from "viem";
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

async function main() {
  const agentKey = process.env.AGENT_PRIVATE_KEY!;
  const feedbackKey = "0x5ad871e0c6e416d5eecf43b90c34903ffc1121a11f507ad5550a91634d6d6ad4";

  const agentAccount = privateKeyToAccount(agentKey as `0x${string}`);
  const feedbackAccount = privateKeyToAccount(feedbackKey as `0x${string}`);

  const publicClient = createPublicClient({ chain: celo, transport: http() });

  // Step 1: Fund the feedback wallet
  console.log("Funding feedback wallet:", feedbackAccount.address);
  const agentWallet = createWalletClient({ account: agentAccount, chain: celo, transport: http() });

  const fundHash = await agentWallet.sendTransaction({
    to: feedbackAccount.address,
    value: parseEther("0.1"),
  });
  console.log("Fund tx:", fundHash);
  await publicClient.waitForTransactionReceipt({ hash: fundHash });
  console.log("Funded!");

  // Step 2: Submit feedback
  const feedbackWallet = createWalletClient({ account: feedbackAccount, chain: celo, transport: http() });

  const feedbacks = [
    { value: 90n, tag2: "BTC long call at 97k was spot on. Cross-market coverage is unmatched." },
    { value: 80n, tag2: "Forex signals consistently profitable. EUR/USD short was perfect timing." },
    { value: 85n, tag2: "Gold analysis caught the breakout. Best commodity signals I've seen." },
  ];

  for (const fb of feedbacks) {
    console.log(`\nSubmitting: ${fb.value}/100`);

    const hash = await feedbackWallet.writeContract({
      address: REPUTATION_REGISTRY,
      abi: reputationAbi,
      functionName: "giveFeedback",
      args: [AGENT_ID, fb.value, 0, "quality", fb.tag2, "https://aaa-agent-steel.vercel.app", "", ZERO_BYTES32],
    });

    console.log("Tx:", hash);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log("Status:", receipt.status);
  }

  console.log("\nAll on-chain feedback submitted!");
}

main().catch(console.error);
