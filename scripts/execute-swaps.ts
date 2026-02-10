/**
 * Execute 3 Mento swaps via fee abstraction (gas in cUSD)
 * Uses dynamic exchange ID discovery from BiPoolManager
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
  formatUnits,
  encodeFunctionData,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

const BROKER = "0x777A8255cA72412f0d706dc03C9D1987306B4CaD" as const;
const BIPOOL_MANAGER = "0x22d9db95E6Ae61c104A7B6F6C78D7993B94ec901" as const;

const TOKENS: Record<string, Address> = {
  cUSD: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
  cEUR: "0xD8763CBa276a3738E6DE85b4b3bF5FDed6D6cA73",
  cREAL: "0xe8537a3d056DA446677B9E9d6c5dB704EaAb4787",
};

const BROKER_ABI = [
  {
    name: "getAmountOut", type: "function", stateMutability: "view",
    inputs: [
      { name: "exchangeProvider", type: "address" },
      { name: "exchangeId", type: "bytes32" },
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    name: "swapIn", type: "function", stateMutability: "nonpayable",
    inputs: [
      { name: "exchangeProvider", type: "address" },
      { name: "exchangeId", type: "bytes32" },
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;

const BIPOOL_ABI = [
  {
    name: "getExchanges", type: "function", stateMutability: "view",
    inputs: [],
    outputs: [{
      name: "exchanges", type: "tuple[]",
      components: [
        { name: "exchangeId", type: "bytes32" },
        { name: "assets", type: "address[]" },
      ],
    }],
  },
] as const;

const ERC20_ABI = [
  {
    name: "approve", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

async function findExchangeId(
  pc: ReturnType<typeof createPublicClient>,
  tokenIn: Address,
  tokenOut: Address
): Promise<`0x${string}`> {
  const exchanges = await pc.readContract({
    address: BIPOOL_MANAGER,
    abi: BIPOOL_ABI,
    functionName: "getExchanges",
  });

  for (const ex of exchanges as Array<{ exchangeId: `0x${string}`; assets: Address[] }>) {
    const assets = ex.assets.map((a: string) => a.toLowerCase());
    if (assets.includes(tokenIn.toLowerCase()) && assets.includes(tokenOut.toLowerCase())) {
      return ex.exchangeId;
    }
  }
  throw new Error(`No exchange for ${tokenIn}/${tokenOut}`);
}

const swaps = [
  { from: "cUSD", to: "cEUR", amount: "2" },
  { from: "cUSD", to: "cREAL", amount: "1.5" },
  { from: "cEUR", to: "cUSD", amount: "0.15" },
];

async function main() {
  const privateKey = process.env.AGENT_PRIVATE_KEY;
  if (!privateKey) { console.error("Set AGENT_PRIVATE_KEY"); process.exit(1); }

  const account = privateKeyToAccount(
    (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as `0x${string}`
  );
  const pc = createPublicClient({ chain: celo, transport: http("https://forno.celo.org") });
  const wallet = createWalletClient({ account, chain: celo, transport: http("https://forno.celo.org") });

  console.log("Agent:", account.address);
  const feeCurrency = TOKENS.cUSD as `0x${string}`;

  for (const swap of swaps) {
    const tokenIn = TOKENS[swap.from];
    const tokenOut = TOKENS[swap.to];
    const amountIn = parseUnits(swap.amount, 18);

    console.log(`\n--- ${swap.amount} ${swap.from} → ${swap.to} ---`);

    try {
      const exchangeId = await findExchangeId(pc, tokenIn, tokenOut);
      console.log("Exchange ID:", exchangeId.slice(0, 18) + "...");

      const amountOut = await pc.readContract({
        address: BROKER, abi: BROKER_ABI, functionName: "getAmountOut",
        args: [BIPOOL_MANAGER, exchangeId, tokenIn, tokenOut, amountIn],
      });
      const rate = Number(formatUnits(amountOut, 18)) / Number(swap.amount);
      console.log(`Quote: ${formatUnits(amountOut, 18)} ${swap.to} (rate: ${rate.toFixed(4)})`);

      // Approve
      const approveData = encodeFunctionData({ abi: ERC20_ABI, functionName: "approve", args: [BROKER, amountIn] });
      const approvalHash = await wallet.sendTransaction({ to: tokenIn, data: approveData, feeCurrency });
      await pc.waitForTransactionReceipt({ hash: approvalHash });
      console.log("Approve:", approvalHash);

      // Swap (1% slippage)
      const minOut = (amountOut * 99n) / 100n;
      const swapData = encodeFunctionData({
        abi: BROKER_ABI, functionName: "swapIn",
        args: [BIPOOL_MANAGER, exchangeId, tokenIn, tokenOut, amountIn, minOut],
      });
      const swapHash = await wallet.sendTransaction({ to: BROKER, data: swapData, feeCurrency });
      const receipt = await pc.waitForTransactionReceipt({ hash: swapHash });
      console.log("Swap:", swapHash, "status:", receipt.status);
    } catch (err) {
      console.error(`Failed:`, err instanceof Error ? err.message.slice(0, 120) : "unknown");
    }
  }

  console.log("\nDone!");
}

main().catch(console.error);
