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
import { createPublicClient, createWalletClient, http, parseUnits, formatUnits, encodeFunctionData, decodeEventLog, fallback } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import { MENTO_TOKENS } from "@/config/contracts";
import type { VaultDeposit } from "@/lib/types";
import { hasAgentSecret, requireSignedAuth, unauthorizedResponse, missingSecretResponse } from "@/lib/auth";
import { isAddress, recoverMessageAddress } from "viem";
import { consumeEoaNonce } from "@/lib/eoa-nonce";

const AGENT_ADDRESS = "0x6652AcDc623b7CCd52E115161d84b949bAf3a303";
const CUSD_ADDRESS = MENTO_TOKENS.cUSD as `0x${string}`;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const VAULT_CUSTODY_KEY_ENV = "VAULT_CUSTODY_PRIVATE_KEY";
const MIN_DEPOSIT_AMOUNT = 1;
const MAX_DEPOSIT_AMOUNT = 10_000;
const WITHDRAW_RESULT_TTL_MS = 15 * 60 * 1000;

const CELO_RPC_URLS = Array.from(
  new Set(
    [
      process.env.CELO_RPC_URL,
      "https://forno.celo.org",
      "https://rpc.ankr.com/celo",
    ].filter(Boolean)
  )
) as string[];

const recentWithdrawResults = new Map<string, { timestamp: number; payload: Record<string, unknown> }>();

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

const erc20TransferEventAbi = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "value", type: "uint256" },
    ],
  },
] as const;

function createCeloPublicClient() {
  return createPublicClient({
    chain: celo,
    transport: fallback(CELO_RPC_URLS.map((u) => http(u, { timeout: 10_000, retryCount: 1 })), { rank: false }),
  });
}

function createCeloWalletClient(account: ReturnType<typeof privateKeyToAccount>) {
  return createWalletClient({
    account,
    chain: celo,
    transport: fallback(CELO_RPC_URLS.map((u) => http(u, { timeout: 10_000, retryCount: 1 })), { rank: false }),
  });
}

function cleanupWithdrawResults(now: number) {
  if (recentWithdrawResults.size < 300) return;
  for (const [k, v] of recentWithdrawResults) {
    if (now - v.timestamp > WITHDRAW_RESULT_TTL_MS) recentWithdrawResults.delete(k);
  }
}

function rememberWithdrawResult(key: string, payload: Record<string, unknown>) {
  cleanupWithdrawResults(Date.now());
  recentWithdrawResults.set(key, { timestamp: Date.now(), payload });
}

function getRememberedWithdrawResult(key: string): Record<string, unknown> | null {
  const v = recentWithdrawResults.get(key);
  if (!v) return null;
  if (Date.now() - v.timestamp > WITHDRAW_RESULT_TTL_MS) {
    recentWithdrawResults.delete(key);
    return null;
  }
  return v.payload;
}

function normalizeAmountInput(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    return trimmed;
  }
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return String(value);
  }
  return null;
}

async function verifyCusdDepositTx(params: {
  depositor: `0x${string}`;
  txHash: `0x${string}`;
  amount: string;
}): Promise<{ ok: true; amountFloat: number } | { ok: false; error: string }> {
  let amountWei: bigint;
  let amountFloat: number;
  try {
    amountWei = parseUnits(params.amount, 18);
    amountFloat = Number(params.amount);
  } catch {
    return { ok: false, error: "Invalid deposit amount format" };
  }
  if (!Number.isFinite(amountFloat) || amountFloat <= 0) {
    return { ok: false, error: "Invalid deposit amount" };
  }

  const client = createCeloPublicClient();
  let receipt;
  let tx;
  try {
    [receipt, tx] = await Promise.all([
      client.getTransactionReceipt({ hash: params.txHash }),
      client.getTransaction({ hash: params.txHash }),
    ]);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unable to read transaction";
    if (/not found|unknown|timeout|network|rpc|gateway/i.test(message)) {
      return {
        ok: false,
        error: "Deposit transaction is not yet indexable. Please retry in a few seconds.",
      };
    }
    return { ok: false, error: "Unable to verify deposit transaction right now" };
  }

  if (receipt.status !== "success") {
    return { ok: false, error: "Deposit transaction is not confirmed" };
  }
  if (tx.from.toLowerCase() !== params.depositor.toLowerCase()) {
    return { ok: false, error: "Transaction sender does not match depositor" };
  }

  const hasMatchingTransfer = receipt.logs.some((log) => {
    if (log.address.toLowerCase() !== CUSD_ADDRESS.toLowerCase()) return false;
    try {
      const decoded = decodeEventLog({
        abi: erc20TransferEventAbi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "Transfer") return false;
      const from = (decoded.args.from as string).toLowerCase();
      const to = (decoded.args.to as string).toLowerCase();
      const value = decoded.args.value as bigint;
      return (
        from === params.depositor.toLowerCase() &&
        to === AGENT_ADDRESS.toLowerCase() &&
        value === amountWei
      );
    } catch {
      return false;
    }
  });

  if (!hasMatchingTransfer) {
    return {
      ok: false,
      error: "No matching on-chain cUSD transfer to vault wallet found in tx",
    };
  }

  return { ok: true, amountFloat };
}

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
    const nonce = (body.nonce as string | undefined)?.trim();
    if (signature && nonce && Number.isFinite(timestamp) && Math.abs(Date.now() - timestamp) <= MAX_CLOCK_SKEW_MS) {
      try {
        if (action === "deposit") {
          const depositor = (body.depositor as string | undefined)?.toLowerCase();
          const amountInput = normalizeAmountInput(body.amount);
          const txHash = body.txHash as string | undefined;
          if (depositor && isAddress(depositor) && amountInput && txHash) {
            if (!(await consumeEoaNonce({ scope: "vault-deposit", signer: depositor, nonce, timestamp }))) {
              return NextResponse.json({ error: "Expired or replayed signature nonce" }, { status: 401 });
            }
            const message = [
              "CeloFX Vault Deposit",
              `depositor:${depositor}`,
              `amount:${amountInput}`,
              `txHash:${txHash}`,
              `nonce:${nonce}`,
              `timestamp:${timestamp}`,
            ].join("\n");
            const recovered = await recoverMessageAddress({ message, signature: signature as `0x${string}` });
            authorized = recovered.toLowerCase() === depositor;
          }
        } else if (action === "withdraw") {
          const depositor = (body.depositor as string | undefined)?.toLowerCase();
          const depositId = body.depositId as string | undefined;
          if (depositor && isAddress(depositor) && depositId) {
            if (!(await consumeEoaNonce({ scope: "vault-withdraw", signer: depositor, nonce, timestamp }))) {
              return NextResponse.json({ error: "Expired or replayed signature nonce" }, { status: 401 });
            }
            const message = [
              "CeloFX Vault Withdraw",
              `depositor:${depositor}`,
              `depositId:${depositId}`,
              `nonce:${nonce}`,
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
    const { depositor, txHash } = body as {
      action: string;
      depositor: string;
      amount: string | number;
      txHash: string;
    };
    const normalizedAmount = normalizeAmountInput(body.amount);

    if (!depositor || !normalizedAmount || !txHash) {
      return NextResponse.json(
        { error: "Missing depositor, amount, or txHash" },
        { status: 400 }
      );
    }
    if (!isAddress(depositor)) {
      return NextResponse.json({ error: "Invalid depositor address" }, { status: 400 });
    }
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return NextResponse.json({ error: "Invalid txHash format" }, { status: 400 });
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

    const verified = await verifyCusdDepositTx({
      depositor: depositor as `0x${string}`,
      txHash: txHash as `0x${string}`,
      amount: normalizedAmount,
    });
    if (!verified.ok) {
      return NextResponse.json({ error: verified.error }, { status: 400 });
    }

    const trades = getTrades();
    const metrics = getVaultMetrics(trades);
    const amount = verified.amountFloat;
    if (amount < MIN_DEPOSIT_AMOUNT) {
      return NextResponse.json(
        { error: `Minimum deposit is ${MIN_DEPOSIT_AMOUNT} cUSD` },
        { status: 400 }
      );
    }
    if (amount > MAX_DEPOSIT_AMOUNT) {
      return NextResponse.json(
        { error: `Maximum single deposit is ${MAX_DEPOSIT_AMOUNT} cUSD` },
        { status: 400 }
      );
    }
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
    const rawIdempotencyKey =
      request.headers.get("x-idempotency-key") ||
      (typeof body.idempotencyKey === "string" ? body.idempotencyKey : null);
    const idempotencyKey = rawIdempotencyKey
      ? `vault-withdraw:${rawIdempotencyKey.trim().slice(0, 128)}`
      : `vault-withdraw:${depositor.toLowerCase()}:${depositId}`;
    const cached = getRememberedWithdrawResult(idempotencyKey);
    if (cached) {
      return NextResponse.json({ ...cached, idempotent: true });
    }

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
    const privateKey =
      process.env[VAULT_CUSTODY_KEY_ENV] ?? process.env.AGENT_PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json(
        { error: `${VAULT_CUSTODY_KEY_ENV} (or AGENT_PRIVATE_KEY) not configured` },
        { status: 503 }
      );
    }

    try {
      const normalizedKey = (
        privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`
      ) as `0x${string}`;
      const account = privateKeyToAccount(normalizedKey);
      if (account.address.toLowerCase() !== AGENT_ADDRESS.toLowerCase()) {
        return NextResponse.json(
          {
            error: "Vault custody key does not match configured vault wallet address",
            expectedWallet: AGENT_ADDRESS,
            configuredWallet: account.address,
          },
          { status: 500 }
        );
      }
      const wallet = createCeloWalletClient(account);
      const publicClient = createCeloPublicClient();

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
      const responsePayload: Record<string, unknown> = {
        success: true,
        withdrawalAmount: parseFloat(withdrawalAmount.toFixed(4)),
        txHash,
        celoscanUrl: `https://celoscan.io/tx/${txHash}`,
        deposit: updated,
      };
      rememberWithdrawResult(idempotencyKey, responsePayload);
      return NextResponse.json(responsePayload);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Withdrawal failed";
      const retryable = /timeout|network|rpc|gateway|temporarily/i.test(message);
      return NextResponse.json(
        {
          error: message,
          retryable,
          nextStep: retryable
            ? "Retry withdrawal in a few seconds."
            : "Check wallet balance, gas conditions, and custody key configuration.",
        },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
