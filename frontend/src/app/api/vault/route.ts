import { NextRequest, NextResponse } from "next/server";
import {
  getVaultMetrics,
  getDeposits,
  addDeposit,
  processWithdrawal,
  getUserPosition,
  getSharePriceHistory,
} from "@/lib/vault-store";
import { getTrades } from "@/lib/trade-store";
import { getAttestation, getTeeHeaders } from "@/lib/tee";
import { createPublicClient, createWalletClient, http, parseUnits, formatUnits, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { MENTO_TOKENS } from "@/config/contracts";
import type { VaultDeposit } from "@/lib/types";
import { hasAgentSecret, requireSignedAuth, unauthorizedResponse, missingSecretResponse } from "@/lib/auth";
import { isAddress, recoverMessageAddress } from "viem";

const AGENT_ADDRESS = "0x6652AcDc623b7CCd52E115161d84b949bAf3a303";
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

const erc20TransferAbi = [
  {
    type: "function",
    name: "transfer",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

export async function GET(request: NextRequest) {
  const teeAttestation = await getAttestation();
  const trades = getTrades();
  const metrics = getVaultMetrics(trades);
  const deposits = getDeposits();

  const address = request.nextUrl.searchParams.get("address");
  const position = address ? getUserPosition(address, trades) : null;

  const priceHistory = getSharePriceHistory(trades);

  return NextResponse.json(
    {
      metrics,
      priceHistory,
      deposits: deposits.map((d) => ({
        id: d.id,
        depositor: d.depositor,
        amount: d.amount,
        sharesIssued: d.sharesIssued,
        sharePriceAtEntry: d.sharePriceAtEntry,
        status: d.status,
        txHash: d.txHash,
        timestamp: d.timestamp,
      })),
      position,
      tee: {
        status: teeAttestation.status,
        verified: teeAttestation.verified,
        timestamp: teeAttestation.timestamp,
      },
    },
    { headers: getTeeHeaders() }
  );
}

export async function POST(request: NextRequest) {
  const authRequest = request.clone();
  const body = await request.json();
  const { action } = body;

  const isUserAction = action === "deposit" || action === "withdraw";
  let authorized = false;

  if (hasAgentSecret()) {
    const auth = await requireSignedAuth(authRequest);
    if (auth.ok) authorized = true;
  }

  if (!authorized && isUserAction) {
    const signature = body.signature as string | undefined;
    const timestamp = Number(body.timestamp);
    if (signature && Number.isFinite(timestamp) && Math.abs(Date.now() - timestamp) <= MAX_CLOCK_SKEW_MS) {
      try {
        if (action === "deposit") {
          const depositor = (body.depositor as string | undefined)?.toLowerCase();
          const amount = body.amount as number | undefined;
          const txHash = body.txHash as string | undefined;
          if (depositor && isAddress(depositor) && amount && txHash) {
            const message = [
              "CeloFX Vault Deposit",
              `depositor:${depositor}`,
              `amount:${amount}`,
              `txHash:${txHash}`,
              `timestamp:${timestamp}`,
            ].join("\n");
            const recovered = await recoverMessageAddress({ message, signature: signature as `0x${string}` });
            authorized = recovered.toLowerCase() === depositor;
          }
        } else if (action === "withdraw") {
          const depositor = (body.depositor as string | undefined)?.toLowerCase();
          const depositId = body.depositId as string | undefined;
          if (depositor && isAddress(depositor) && depositId) {
            const message = [
              "CeloFX Vault Withdraw",
              `depositor:${depositor}`,
              `depositId:${depositId}`,
              `timestamp:${timestamp}`,
            ].join("\n");
            const recovered = await recoverMessageAddress({ message, signature: signature as `0x${string}` });
            authorized = recovered.toLowerCase() === depositor;
          }
        }
      } catch {
        authorized = false;
      }
    }
  }

  if (!authorized) {
    if (!hasAgentSecret() && !isUserAction) return missingSecretResponse();
    return unauthorizedResponse();
  }

  if (action === "deposit") {
    const { depositor, amount, txHash } = body as {
      action: string;
      depositor: string;
      amount: number;
      txHash: string;
    };

    if (!depositor || !amount || !txHash) {
      return NextResponse.json(
        { error: "Missing depositor, amount, or txHash" },
        { status: 400 }
      );
    }

    const existing = getDeposits().find(
      (d) =>
        d.txHash.toLowerCase() === txHash.toLowerCase() &&
        d.depositor.toLowerCase() === depositor.toLowerCase()
    );
    if (existing) {
      return NextResponse.json({
        success: true,
        deposit: existing,
        idempotent: true,
      });
    }

    const trades = getTrades();
    const metrics = getVaultMetrics(trades);
    const sharesIssued = amount / metrics.sharePrice;

    const deposit: VaultDeposit = {
      id: `deposit-${Date.now()}`,
      depositor,
      amount,
      sharesIssued: parseFloat(sharesIssued.toFixed(4)),
      sharePriceAtEntry: metrics.sharePrice,
      txHash,
      status: "active",
      timestamp: Date.now(),
    };

    addDeposit(deposit);

    return NextResponse.json({
      success: true,
      deposit,
      newMetrics: getVaultMetrics(trades),
    });
  }

  if (action === "withdraw") {
    const { depositId, depositor } = body as {
      action: string;
      depositId: string;
      depositor: string;
    };

    if (!depositId || !depositor) {
      return NextResponse.json(
        { error: "Missing depositId or depositor" },
        { status: 400 }
      );
    }

    const trades = getTrades();
    const metrics = getVaultMetrics(trades);

    // Find the deposit to calculate withdrawal amount
    const allDeposits = getDeposits();
    const deposit = allDeposits.find(
      (d) =>
        d.id === depositId &&
        d.depositor.toLowerCase() === depositor.toLowerCase()
    );

    if (!deposit || deposit.status === "withdrawn") {
      return NextResponse.json(
        { error: "Deposit not found or already withdrawn" },
        { status: 404 }
      );
    }

    const withdrawalAmount = deposit.sharesIssued * metrics.sharePrice;

    // Send cUSD from agent wallet to depositor
    const privateKey = process.env.AGENT_PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json(
        { error: "AGENT_PRIVATE_KEY not configured" },
        { status: 503 }
      );
    }

    try {
      const normalizedKey = (
        privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`
      ) as `0x${string}`;
      const account = privateKeyToAccount(normalizedKey);
      const wallet = createWalletClient({
        account,
        chain: celo,
        transport: http("https://forno.celo.org"),
      });
      const publicClient = createPublicClient({
        chain: celo,
        transport: http("https://forno.celo.org"),
      });

      // Verify agent wallet has sufficient cUSD balance
      const agentBalance = await publicClient.readContract({
        address: MENTO_TOKENS.cUSD as `0x${string}`,
        abi: [{
          type: "function",
          name: "balanceOf",
          inputs: [{ name: "account", type: "address" }],
          outputs: [{ name: "", type: "uint256" }],
          stateMutability: "view",
        }] as const,
        functionName: "balanceOf",
        args: [AGENT_ADDRESS as `0x${string}`],
      });

      const balanceFloat = parseFloat(formatUnits(agentBalance, 18));
      if (balanceFloat < withdrawalAmount) {
        return NextResponse.json(
          { error: `Insufficient agent balance: ${balanceFloat.toFixed(2)} cUSD available, ${withdrawalAmount.toFixed(2)} cUSD needed` },
          { status: 400 }
        );
      }

      const amountWei = parseUnits(withdrawalAmount.toFixed(6), 18);
      const feeCurrency = MENTO_TOKENS.cUSD as `0x${string}`;

      const data = encodeFunctionData({
        abi: erc20TransferAbi,
        functionName: "transfer",
        args: [depositor as `0x${string}`, amountWei],
      });

      const txHash = await wallet.sendTransaction({
        to: MENTO_TOKENS.cUSD as `0x${string}`,
        data,
        feeCurrency,
      });

      await publicClient.waitForTransactionReceipt({ hash: txHash });

      const updated = processWithdrawal(depositId, txHash);

      return NextResponse.json({
        success: true,
        withdrawalAmount: parseFloat(withdrawalAmount.toFixed(4)),
        txHash,
        celoscanUrl: `https://celoscan.io/tx/${txHash}`,
        deposit: updated,
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Withdrawal failed" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
