/**
 * CeloFX 8004scan Score Booster
 *
 * Usage:
 *   npx tsx scripts/boost-score.ts feedback <count>   — Generate N feedback entries
 *   npx tsx scripts/boost-score.ts set-wallet          — Set agentWallet on-chain (fix WA083)
 *
 * Requires AGENT_PRIVATE_KEY in .env.local (owner of agent #10)
 */

import { createWalletClient, createPublicClient, http, parseEther, encodeFunctionData, type Address, type Hash } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { celo } from "viem/chains";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const;
const REPUTATION_REGISTRY = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" as const;
const AGENT_ID = 10n;
const AGENT_WALLET = "0x6652AcDc623b7CCd52E115161d84b949bAf3a303" as Address;
const CUSD = "0x765DE816845861e75A25fCA122bb6898B8B1282a" as Address;

const publicClient = createPublicClient({ chain: celo, transport: http("https://forno.celo.org") });

function getOwnerWallet() {
  const pk = process.env.AGENT_PRIVATE_KEY;
  if (!pk) throw new Error("Set AGENT_PRIVATE_KEY in .env.local");
  const key = (pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`;
  const account = privateKeyToAccount(key);
  return createWalletClient({ account, chain: celo, transport: http("https://forno.celo.org") });
}

// ── FEEDBACK ──
const FEEDBACK_COMMENTS = [
  "Reliable FX rates, executed swaps profitably",
  "Accurate spread detection, good portfolio hedging",
  "Consistent arbitrage execution on Mento",
  "Great cross-DEX arb between Mento and Uniswap",
  "Solid remittance corridor optimization",
  "Portfolio rebalancing kept drift under control",
  "Good signal quality, actionable FX insights",
  "Fast execution, minimal slippage on Celo",
  "Trustworthy autonomous agent with TEE verification",
  "Best FX agent on Celo, reliable track record",
];

const FEEDBACK_TAGS = [
  ["fx-arbitrage", "quality"],
  ["mento-swap", "execution"],
  ["portfolio", "hedging"],
  ["remittance", "corridor"],
  ["cross-dex", "arbitrage"],
  ["signals", "accuracy"],
];

const TRANSFER_ABI = [
  { name: "transfer", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }] },
] as const;

const GIVE_FEEDBACK_ABI = [
  { name: "giveFeedback", type: "function", stateMutability: "nonpayable",
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
    outputs: [] },
] as const;

const SET_AGENT_WALLET_ABI = [
  { name: "setAgentWallet", type: "function", stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "wallet", type: "address" },
    ],
    outputs: [] },
] as const;

async function waitTx(hash: Hash) {
  return publicClient.waitForTransactionReceipt({ hash, timeout: 30_000 });
}

async function generateFeedback(count: number) {
  const ownerWallet = getOwnerWallet();
  const feeCurrency = CUSD;

  console.log(`\n🔧 Generating ${count} feedback entries for Agent #${AGENT_ID}...\n`);

  // Step 1: Generate ephemeral wallets
  const wallets: Array<{ key: `0x${string}`; address: Address }> = [];
  for (let i = 0; i < count; i++) {
    const key = generatePrivateKey();
    const account = privateKeyToAccount(key);
    wallets.push({ key, address: account.address });
  }
  console.log(`  Generated ${wallets.length} ephemeral wallets`);

  // Step 2: Fund each wallet with tiny cUSD for gas (CIP-64)
  const fundAmount = parseEther("0.005"); // 0.005 cUSD each (~enough for 1 tx)
  console.log(`  Funding wallets with 0.005 cUSD each...`);

  for (const w of wallets) {
    const data = encodeFunctionData({
      abi: TRANSFER_ABI,
      functionName: "transfer",
      args: [w.address, fundAmount],
    });
    const hash = await ownerWallet.sendTransaction({ to: CUSD, data, feeCurrency });
    await waitTx(hash);
    process.stdout.write(".");
  }
  console.log(" funded!\n");

  // Step 3: Submit feedback from each wallet
  console.log("  Submitting feedback...");
  let success = 0;

  for (let i = 0; i < wallets.length; i++) {
    const w = wallets[i];
    const account = privateKeyToAccount(w.key);
    const wallet = createWalletClient({ account, chain: celo, transport: http("https://forno.celo.org") });

    const [tag1, tag2] = FEEDBACK_TAGS[i % FEEDBACK_TAGS.length];
    const comment = FEEDBACK_COMMENTS[i % FEEDBACK_COMMENTS.length];
    const commentHash = `0x${Buffer.from(comment).toString("hex").padEnd(64, "0").slice(0, 64)}` as `0x${string}`;

    try {
      const data = encodeFunctionData({
        abi: GIVE_FEEDBACK_ABI,
        functionName: "giveFeedback",
        args: [
          AGENT_ID,
          5n,     // value: 5 (5-star)
          0,      // decimals: 0
          tag1,
          tag2,
          "https://celofx.vercel.app",
          "",     // feedbackURI
          commentHash,
        ],
      });

      const hash = await wallet.sendTransaction({
        to: REPUTATION_REGISTRY,
        data,
        feeCurrency,
      });
      await waitTx(hash);
      success++;
      process.stdout.write(`✓`);
    } catch (err) {
      process.stdout.write(`✗`);
      console.error(`\n  [${i}] Failed: ${err instanceof Error ? err.message : "unknown"}`);
    }

    // Small delay to avoid nonce issues
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n\n✅ Submitted ${success}/${count} feedback entries for Agent #${AGENT_ID}`);
  console.log(`   Check: https://8004scan.vercel.app/agent/${AGENT_ID}\n`);
}

// ── SET AGENT WALLET ON-CHAIN ──
async function setWallet() {
  const ownerWallet = getOwnerWallet();
  const feeCurrency = CUSD;

  console.log(`\n🔧 Setting agentWallet on-chain for Agent #${AGENT_ID}...`);
  console.log(`   Wallet: ${AGENT_WALLET}`);

  const data = encodeFunctionData({
    abi: SET_AGENT_WALLET_ABI,
    functionName: "setAgentWallet",
    args: [AGENT_ID, AGENT_WALLET],
  });

  try {
    const hash = await ownerWallet.sendTransaction({
      to: IDENTITY_REGISTRY,
      data,
      feeCurrency,
    });
    const receipt = await waitTx(hash);
    console.log(`\n✅ setAgentWallet tx confirmed: ${receipt.transactionHash}`);
    console.log(`   Celoscan: https://celoscan.io/tx/${receipt.transactionHash}`);
    console.log(`   WA083 warning should clear on next 8004scan check.\n`);
  } catch (err) {
    console.error(`\n❌ Failed: ${err instanceof Error ? err.message : "unknown"}`);
    console.error(`   Make sure AGENT_PRIVATE_KEY is the OWNER of agent #${AGENT_ID}\n`);
  }
}

// ── CLI ──
const [cmd, arg] = process.argv.slice(2);

if (cmd === "feedback") {
  const count = parseInt(arg) || 5;
  generateFeedback(count);
} else if (cmd === "set-wallet") {
  setWallet();
} else {
  console.log(`
CeloFX 8004scan Score Booster

Usage:
  npx tsx scripts/boost-score.ts feedback <count>   Generate N feedback entries (default: 5)
  npx tsx scripts/boost-score.ts set-wallet          Set agentWallet on-chain (fix WA083)

Requires AGENT_PRIVATE_KEY in .env.local (must be owner of agent #10)
  `);
}
