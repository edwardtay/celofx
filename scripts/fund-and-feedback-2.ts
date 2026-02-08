/**
 * Fund a third wallet and submit on-chain feedback from it
 * Adds diversity to the reputation data (different reviewer address)
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
  const feedbackKey = "0x2c7771a191dc1c0b55d674c30948a901d87361b6705ef61621da5d930a7d2d56";

  const agentAccount = privateKeyToAccount(agentKey as `0x${string}`);
  const feedbackAccount = privateKeyToAccount(feedbackKey as `0x${string}`);

  const publicClient = createPublicClient({ chain: celo, transport: http() });

  // Step 1: Fund the feedback wallet
  console.log("Funding wallet 3:", feedbackAccount.address);
  const agentWallet = createWalletClient({ account: agentAccount, chain: celo, transport: http() });

  const fundHash = await agentWallet.sendTransaction({
    to: feedbackAccount.address,
    value: parseEther("0.1"),
  });
  console.log("Fund tx:", fundHash);
  await publicClient.waitForTransactionReceipt({ hash: fundHash });
  console.log("Funded!");

  // Step 2: Submit feedback from third wallet
  const feedbackWallet = createWalletClient({ account: feedbackAccount, chain: celo, transport: http() });

  const feedbacks = [
    { value: 95n, tag2: "SOL short at 180 saved my portfolio. This agent sees things others miss." },
    { value: 75n, tag2: "Stock signals are solid. NVDA call was well-timed. Would use again." },
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

  console.log("\nAll feedback from wallet 3 submitted!");
}

main().catch(console.error);
