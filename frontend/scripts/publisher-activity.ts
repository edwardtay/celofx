/**
 * Publisher activity helper for 8004scan.
 *
 * Usage:
 *   npx tsx scripts/publisher-activity.ts transfer <to> <amountCusd>
 *
 * Example:
 *   npx tsx scripts/publisher-activity.ts transfer 0xabc... 0.5
 *
 * Requires AGENT_PRIVATE_KEY in frontend/.env.local
 */

import { createPublicClient, createWalletClient, encodeFunctionData, http, parseUnits, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const CUSD = "0x765DE816845861e75A25fCA122bb6898B8B1282a" as Address;
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
] as const;

function getWalletClient() {
  const pk = process.env.AGENT_PRIVATE_KEY;
  if (!pk) throw new Error("Missing AGENT_PRIVATE_KEY in frontend/.env.local");
  const account = privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as `0x${string}`);
  return createWalletClient({ account, chain: celo, transport: http(FORNO) });
}

async function transfer(to: Address, amountCusd: string) {
  const walletClient = getWalletClient();
  const publicClient = createPublicClient({ chain: celo, transport: http(FORNO) });
  const amount = parseUnits(amountCusd, 18);
  const data = encodeFunctionData({
    abi: TRANSFER_ABI,
    functionName: "transfer",
    args: [to, amount],
  });

  const hash = await walletClient.sendTransaction({
    to: CUSD,
    data,
    feeCurrency: CUSD,
  });
  console.log(`Tx hash: ${hash}`);
  await publicClient.waitForTransactionReceipt({ hash, timeout: 120_000 });
  console.log(`Confirmed: https://celoscan.io/tx/${hash}`);
}

async function main() {
  const [cmd, to, amount] = process.argv.slice(2);
  if (cmd !== "transfer" || !to || !amount) {
    console.log("Usage: npx tsx scripts/publisher-activity.ts transfer <to> <amountCusd>");
    process.exit(1);
  }
  await transfer(to as Address, amount);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

