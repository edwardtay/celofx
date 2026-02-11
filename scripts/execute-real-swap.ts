/**
 * Execute a real Mento swap on Celo mainnet to prove the agent loop works.
 * Swaps a small amount of cUSD → cEUR via Mento Broker with CIP-64 fee abstraction.
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

const ERC20_BALANCE_ABI = [{
  name: "balanceOf", type: "function", stateMutability: "view",
  inputs: [{ name: "account", type: "address" }],
  outputs: [{ name: "", type: "uint256" }],
}] as const;

const ERC20_APPROVE_ABI = [{
  name: "approve", type: "function", stateMutability: "nonpayable",
  inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
  outputs: [{ name: "", type: "bool" }],
}] as const;

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

const BIPOOL_ABI = [{
  name: "getExchanges", type: "function", stateMutability: "view",
  inputs: [],
  outputs: [{
    name: "exchanges", type: "tuple[]",
    components: [
      { name: "exchangeId", type: "bytes32" },
      { name: "assets", type: "address[]" },
    ],
  }],
}] as const;

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
  console.log("\n=== Pre-Swap Balances ===");
  for (const [name, addr] of Object.entries(TOKENS)) {
    const bal = await pc.readContract({
      address: addr, abi: ERC20_BALANCE_ABI, functionName: "balanceOf",
      args: [account.address],
    });
    console.log(`  ${name}: ${formatUnits(bal, 18)}`);
  }

  // Fetch real forex rate
  const forexRes = await fetch("https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR,BRL");
  const forex = await forexRes.json();
  const realEurPerUsd = forex.rates?.EUR ?? 0.926;
  const realBrlPerUsd = forex.rates?.BRL ?? 5.7;

  // Find exchanges
  const exchanges = await pc.readContract({
    address: BIPOOL_MANAGER, abi: BIPOOL_ABI, functionName: "getExchanges",
  });

  let eurExchangeId: `0x${string}` | null = null;
  let brlExchangeId: `0x${string}` | null = null;
  for (const ex of exchanges as Array<{ exchangeId: `0x${string}`; assets: Address[] }>) {
    const assets = ex.assets.map((a: string) => a.toLowerCase());
    if (assets.includes(TOKENS.cUSD.toLowerCase()) && assets.includes(TOKENS.cEUR.toLowerCase())) {
      eurExchangeId = ex.exchangeId;
    }
    if (assets.includes(TOKENS.cUSD.toLowerCase()) && assets.includes(TOKENS.cREAL.toLowerCase())) {
      brlExchangeId = ex.exchangeId;
    }
  }

  // Check both pairs for best opportunity
  const SWAP_AMOUNT = "0.5"; // Small amount to prove it works
  const amountIn = parseUnits(SWAP_AMOUNT, 18);
  const feeCurrency = TOKENS.cUSD as `0x${string}`;

  console.log("\n=== Checking Spreads ===");

  // cUSD → cEUR
  if (eurExchangeId) {
    const amountOut = await pc.readContract({
      address: BROKER, abi: BROKER_ABI, functionName: "getAmountOut",
      args: [BIPOOL_MANAGER, eurExchangeId, TOKENS.cUSD, TOKENS.cEUR, amountIn],
    });
    const mentoRate = Number(formatUnits(amountOut, 18)) / Number(SWAP_AMOUNT);
    const spread = ((mentoRate - realEurPerUsd) / realEurPerUsd * 100);
    console.log(`cUSD→cEUR: Mento ${mentoRate.toFixed(6)} vs Forex ${realEurPerUsd} = ${spread.toFixed(3)}% spread`);
  }

  // cUSD → cREAL
  if (brlExchangeId) {
    const amountOut = await pc.readContract({
      address: BROKER, abi: BROKER_ABI, functionName: "getAmountOut",
      args: [BIPOOL_MANAGER, brlExchangeId, TOKENS.cUSD, TOKENS.cREAL, amountIn],
    });
    const mentoRate = Number(formatUnits(amountOut, 18)) / Number(SWAP_AMOUNT);
    const spread = ((mentoRate - realBrlPerUsd) / realBrlPerUsd * 100);
    console.log(`cUSD→cREAL: Mento ${mentoRate.toFixed(4)} vs Forex ${realBrlPerUsd} = ${spread.toFixed(3)}% spread`);
  }

  // Execute: swap 1 cEUR → cUSD (agent has 5.8 cEUR, proving the loop works)
  if (!eurExchangeId) { console.error("No cUSD/cEUR exchange"); process.exit(1); }

  const swapAmountEur = parseUnits("1", 18);
  const amountOut = await pc.readContract({
    address: BROKER, abi: BROKER_ABI, functionName: "getAmountOut",
    args: [BIPOOL_MANAGER, eurExchangeId, TOKENS.cEUR, TOKENS.cUSD, swapAmountEur],
  });

  const forexEurToUsd = 1 / realEurPerUsd;
  const mentoEurToUsd = Number(formatUnits(amountOut, 18));
  const reverseSpread = ((mentoEurToUsd - forexEurToUsd) / forexEurToUsd * 100);
  console.log(`\n=== Executing: 1 cEUR → cUSD ===`);
  console.log(`Mento rate: 1 cEUR = ${mentoEurToUsd.toFixed(6)} cUSD`);
  console.log(`Forex rate: 1 EUR  = ${forexEurToUsd.toFixed(6)} USD`);
  console.log(`Spread: ${reverseSpread.toFixed(3)}%`);
  console.log(`Expected output: ${formatUnits(amountOut, 18)} cUSD`);

  // Approve cEUR to Broker
  const approveData = encodeFunctionData({ abi: ERC20_APPROVE_ABI, functionName: "approve", args: [BROKER, swapAmountEur] });
  console.log("Sending approval tx...");
  const approvalHash = await wallet.sendTransaction({ to: TOKENS.cEUR, data: approveData, feeCurrency });
  await pc.waitForTransactionReceipt({ hash: approvalHash });
  console.log("Approval confirmed:", approvalHash);

  // Swap with 2% slippage
  const minOut = (amountOut * 98n) / 100n;
  const swapData = encodeFunctionData({
    abi: BROKER_ABI, functionName: "swapIn",
    args: [BIPOOL_MANAGER, eurExchangeId, TOKENS.cEUR, TOKENS.cUSD, swapAmountEur, minOut],
  });
  console.log("Sending swap tx...");
  const swapHash = await wallet.sendTransaction({ to: BROKER, data: swapData, feeCurrency });
  const receipt = await pc.waitForTransactionReceipt({ hash: swapHash });

  console.log("\n=== SWAP 1 RESULT (cEUR → cUSD) ===");
  console.log("Status:", receipt.status);
  console.log("Swap tx:", swapHash);
  console.log(`Celoscan: https://celoscan.io/tx/${swapHash}`);

  // Now swap some cUSD back to cEUR to show round-trip
  console.log("\n=== Executing reverse: 1 cUSD → cEUR ===");
  const reverseAmountIn = parseUnits("1", 18);
  const reverseOut = await pc.readContract({
    address: BROKER, abi: BROKER_ABI, functionName: "getAmountOut",
    args: [BIPOOL_MANAGER, eurExchangeId, TOKENS.cUSD, TOKENS.cEUR, reverseAmountIn],
  });
  console.log(`Expected output: ${formatUnits(reverseOut, 18)} cEUR`);

  const approveData2 = encodeFunctionData({ abi: ERC20_APPROVE_ABI, functionName: "approve", args: [BROKER, reverseAmountIn] });
  const approvalHash2 = await wallet.sendTransaction({ to: TOKENS.cUSD, data: approveData2, feeCurrency });
  await pc.waitForTransactionReceipt({ hash: approvalHash2 });

  const minOut2 = (reverseOut * 98n) / 100n;
  const swapData2 = encodeFunctionData({
    abi: BROKER_ABI, functionName: "swapIn",
    args: [BIPOOL_MANAGER, eurExchangeId, TOKENS.cUSD, TOKENS.cEUR, reverseAmountIn, minOut2],
  });
  const swapHash2 = await wallet.sendTransaction({ to: BROKER, data: swapData2, feeCurrency });
  const receipt2 = await pc.waitForTransactionReceipt({ hash: swapHash2 });

  console.log("\n=== SWAP 2 RESULT (cUSD → cEUR) ===");
  console.log("Status:", receipt2.status);
  console.log("Swap tx:", swapHash2);
  console.log(`Celoscan: https://celoscan.io/tx/${swapHash2}`);

  // Final balances
  console.log("\n=== Post-Swap Balances ===");
  for (const [name, addr] of Object.entries(TOKENS)) {
    const bal = await pc.readContract({
      address: addr, abi: ERC20_BALANCE_ABI, functionName: "balanceOf",
      args: [account.address],
    });
    console.log(`  ${name}: ${formatUnits(bal, 18)}`);
  }

  console.log("\n✓ Real on-chain Mento swap proof complete");
  console.log("Forward swap: https://celoscan.io/tx/" + swapHash);
  console.log("Reverse swap: https://celoscan.io/tx/" + swapHash2);
}

main().catch(console.error);
