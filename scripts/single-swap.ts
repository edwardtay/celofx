/**
 * Execute a single Mento swap: 1 cUSD → cEUR
 * Checks wallet balance first, then executes via Mento Broker with fee abstraction
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
  CELO: "0x471EcE3750Da237f93B8E339c536989b8978a438",
};

const ERC20_BALANCE_ABI = [
  {
    name: "balanceOf", type: "function", stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const ERC20_APPROVE_ABI = [
  {
    name: "approve", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

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

async function main() {
  const privateKey = process.env.AGENT_PRIVATE_KEY;
  if (!privateKey) { console.error("Set AGENT_PRIVATE_KEY"); process.exit(1); }

  const account = privateKeyToAccount(
    (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as `0x${string}`
  );
  const pc = createPublicClient({ chain: celo, transport: http("https://forno.celo.org") });
  const wallet = createWalletClient({ account, chain: celo, transport: http("https://forno.celo.org") });

  console.log("Agent wallet:", account.address);

  // Check balances
  console.log("\n=== Wallet Balances ===");
  for (const [name, addr] of Object.entries(TOKENS)) {
    const bal = await pc.readContract({
      address: addr, abi: ERC20_BALANCE_ABI, functionName: "balanceOf",
      args: [account.address],
    });
    console.log(`  ${name}: ${formatUnits(bal, 18)}`);
  }

  // Fetch real forex rate
  const forexRes = await fetch("https://api.frankfurter.dev/v1/latest?base=EUR&symbols=USD");
  const forex = await forexRes.json();
  const realUsdPerEur = forex.rates?.USD ?? 1.19;
  console.log(`\nReal forex USD/EUR: ${realUsdPerEur} (1 EUR = ${realUsdPerEur} USD)`);

  // Find exchange ID
  const exchanges = await pc.readContract({
    address: BIPOOL_MANAGER, abi: BIPOOL_ABI, functionName: "getExchanges",
  });
  let exchangeId: `0x${string}` | null = null;
  for (const ex of exchanges as Array<{ exchangeId: `0x${string}`; assets: Address[] }>) {
    const assets = ex.assets.map((a: string) => a.toLowerCase());
    if (assets.includes(TOKENS.cUSD.toLowerCase()) && assets.includes(TOKENS.cEUR.toLowerCase())) {
      exchangeId = ex.exchangeId;
      break;
    }
  }
  if (!exchangeId) { console.error("No cUSD/cEUR exchange found"); process.exit(1); }

  // Get quote: 1 cEUR → cUSD (sell cEUR for cUSD)
  const amountIn = parseUnits("1", 18);
  const amountOut = await pc.readContract({
    address: BROKER, abi: BROKER_ABI, functionName: "getAmountOut",
    args: [BIPOOL_MANAGER, exchangeId, TOKENS.cEUR, TOKENS.cUSD, amountIn],
  });
  const mentoRate = Number(formatUnits(amountOut, 18));
  const spread = ((mentoRate - realUsdPerEur) / realUsdPerEur * 100);
  console.log(`Mento rate (1 cEUR → cUSD): ${mentoRate.toFixed(6)}`);
  console.log(`Real forex (1 EUR → USD):   ${realUsdPerEur}`);
  console.log(`Spread vs forex: ${spread.toFixed(3)}%`);

  // Execute swap: 1 cEUR → cUSD
  console.log("\n=== Executing: 1 cEUR → cUSD ===");
  const feeCurrency = TOKENS.cUSD as `0x${string}`;

  // Approve cEUR spending
  const approveData = encodeFunctionData({ abi: ERC20_APPROVE_ABI, functionName: "approve", args: [BROKER, amountIn] });
  console.log("Sending approval tx...");
  const approvalHash = await wallet.sendTransaction({ to: TOKENS.cEUR, data: approveData, feeCurrency });
  await pc.waitForTransactionReceipt({ hash: approvalHash });
  console.log("Approval confirmed:", approvalHash);

  // Swap with 1% slippage
  const minOut = (amountOut * 99n) / 100n;
  const swapData = encodeFunctionData({
    abi: BROKER_ABI, functionName: "swapIn",
    args: [BIPOOL_MANAGER, exchangeId, TOKENS.cEUR, TOKENS.cUSD, amountIn, minOut],
  });
  console.log("Sending swap tx...");
  const swapHash = await wallet.sendTransaction({ to: BROKER, data: swapData, feeCurrency });
  const receipt = await pc.waitForTransactionReceipt({ hash: swapHash });
  console.log("Swap confirmed:", swapHash);
  console.log("Status:", receipt.status);
  console.log(`Celoscan: https://celoscan.io/tx/${swapHash}`);

  // Post-swap balance
  console.log("\n=== Post-Swap Balances ===");
  for (const [name, addr] of Object.entries(TOKENS)) {
    const bal = await pc.readContract({
      address: addr, abi: ERC20_BALANCE_ABI, functionName: "balanceOf",
      args: [account.address],
    });
    console.log(`  ${name}: ${formatUnits(bal, 18)}`);
  }
}

main().catch(console.error);
