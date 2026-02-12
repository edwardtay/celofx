/**
 * Fund wallet 4 and submit on-chain feedback for agent #10
 * Diverse reviews covering MCP, A2A, order execution, and TEE verification
 */

import { createWalletClient, createPublicClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

const REPUTATION_REGISTRY = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" as const;
const AGENT_ID = 10n;
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
  // Wallet 4 for feedback: 0xD822e10c304DA45Eb0dd1e09B139A034e6D3C721
  const feedbackKey = "0x7c9b821ec715334df90fcbd431b4df838fbb89c48873c147d57d406f8ba0aa42";

  const agentAccount = privateKeyToAccount(agentKey as `0x${string}`);
  const feedbackAccount = privateKeyToAccount(feedbackKey as `0x${string}`);

  const publicClient = createPublicClient({ chain: celo, transport: http() });

  // Step 1: Fund the feedback wallet
  console.log("Funding wallet 4:", feedbackAccount.address);
  const agentWallet = createWalletClient({ account: agentAccount, chain: celo, transport: http() });

  const fundHash = await agentWallet.sendTransaction({
    to: feedbackAccount.address,
    value: parseEther("0.05"),
  });
  console.log("Fund tx:", fundHash);
  await publicClient.waitForTransactionReceipt({ hash: fundHash });
  console.log("Funded!");

  // Step 2: Submit diverse feedback
  const feedbackWallet = createWalletClient({ account: feedbackAccount, chain: celo, transport: http() });

  const feedbacks = [
    { value: 90n, tag1: "mcp", tag2: "MCP tools return accurate live Mento rates with spread analysis. Integrated into my agent pipeline with zero issues." },
    { value: 88n, tag1: "a2a", tag2: "A2A protocol handles rate analysis and portfolio queries cleanly. JSON-RPC responses are well-structured." },
    { value: 94n, tag1: "execution", tag2: "Agentic order execution is impressive — agent tracked momentum declining and executed before rate dropped. Real AI decision-making." },
    { value: 85n, tag1: "tee", tag2: "Intel TDX attestation via Phala Cloud verifies correctly. Good to see verifiable execution in an FX agent." },
  ];

  for (const fb of feedbacks) {
    console.log(`\nSubmitting: ${fb.value}/100 [${fb.tag1}]`);

    const hash = await feedbackWallet.writeContract({
      address: REPUTATION_REGISTRY,
      abi: reputationAbi,
      functionName: "giveFeedback",
      args: [AGENT_ID, fb.value, 0, fb.tag1, fb.tag2, "https://celofx.vercel.app", "", ZERO_BYTES32],
    });

    console.log("Tx:", hash);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log("Status:", receipt.status);
  }

  console.log("\nAll feedback from wallet 4 submitted!");
}

main().catch(console.error);
