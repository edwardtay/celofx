import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, type Hex, formatUnits, fallback } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo, mainnet } from "viem/chains";
import { buildSwapTx, buildTransferTx, TOKENS, type MentoToken } from "@/lib/mento-sdk";
import { hasAgentSecret, requireSignedAuth, unauthorizedResponse, missingSecretResponse } from "@/lib/auth";
import { recoverMessageAddress } from "viem";
import { deriveUserAgentWallet } from "@/lib/user-agent-wallet";
import { consumeEoaNonce } from "@/lib/eoa-nonce";

const CUSD = "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const MIN_GAS_BUFFER_CUSD = 0.005;
const EXECUTION_RESULT_TTL_MS = 15 * 60 * 1000;

const ENS_RPC_URLS = [
  "https://cloudflare-eth.com",
  "https://ethereum-rpc.publicnode.com",
];

const CELO_RPC_URLS = Array.from(
  new Set(
    [
      process.env.CELO_RPC_URL,
      "https://forno.celo.org",
      "https://rpc.ankr.com/celo",
    ].filter(Boolean)
  )
) as string[];

const recentExecutions = new Map<
  string,
  { timestamp: number; payload: Record<string, unknown> }
>();

type ExecuteBody = {
  fromToken: MentoToken;
  toToken: MentoToken;
  amount: string;
  recipientAddress: string;
  corridor?: string;
  slippage?: number;
  requester?: string;
  signature?: string;
  timestamp?: number;
  nonce?: string;
};

function cleanupRecentExecutions(now: number) {
  if (recentExecutions.size < 200) return;
  for (const [key, entry] of recentExecutions) {
    if (now - entry.timestamp > EXECUTION_RESULT_TTL_MS) {
      recentExecutions.delete(key);
    }
  }
}

function rememberExecution(key: string, payload: Record<string, unknown>) {
  cleanupRecentExecutions(Date.now());
  recentExecutions.set(key, { timestamp: Date.now(), payload });
}

function getRememberedExecution(key: string): Record<string, unknown> | null {
  const existing = recentExecutions.get(key);
  if (!existing) return null;
  if (Date.now() - existing.timestamp > EXECUTION_RESULT_TTL_MS) {
    recentExecutions.delete(key);
    return null;
  }
  return existing.payload;
}

function createCeloPublicClient() {
  return createPublicClient({
    chain: celo,
    transport: fallback(
      CELO_RPC_URLS.map((url) => http(url, { timeout: 10_000, retryCount: 1 })),
      { rank: false }
    ),
  });
}

function createCeloWalletClient(account: ReturnType<typeof privateKeyToAccount>) {
  return createWalletClient({
    account,
    chain: celo,
    transport: fallback(
      CELO_RPC_URLS.map((url) => http(url, { timeout: 10_000, retryCount: 1 })),
      { rank: false }
    ),
  });
}

const erc20BalanceAbi = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

function isAddress(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

async function resolveRecipientAddress(input: string): Promise<`0x${string}` | null> {
  const raw = input.trim();
  if (isAddress(raw)) return raw;
  if (!raw.includes(".")) return null;

  for (const url of ENS_RPC_URLS) {
    try {
      const ensClient = createPublicClient({
        chain: mainnet,
        transport: http(url, { timeout: 7000, retryCount: 1 }),
      });
      const resolved = await ensClient.getEnsAddress({ name: raw as `${string}.eth` });
      if (resolved) return resolved;
    } catch {
      // try next resolver
    }
  }
  return null;
}

export async function POST(request: Request) {
  const authRequest = request.clone();
  let body: ExecuteBody;
  try {
    body = (await request.json()) as ExecuteBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { fromToken, toToken, amount, recipientAddress, corridor, slippage = 1 } = body;
  if (!fromToken || !toToken || !amount || !recipientAddress) {
    return NextResponse.json(
      { error: "Missing required fields: fromToken, toToken, amount, recipientAddress" },
      { status: 400 }
    );
  }
  const resolvedRecipient = await resolveRecipientAddress(recipientAddress);
  if (!resolvedRecipient) {
    return NextResponse.json({ error: "Invalid recipient. Use 0x address or resolvable ENS name." }, { status: 400 });
  }

  let authMode: "agent_api" | "eoa_signed" | null = null;
  let requester: string | null = null;
  const hasAgentHeaders = Boolean(
    request.headers.get("x-agent-signature") || request.headers.get("authorization")
  );

  let idempotencyKey: string | null = null;
  if (hasAgentHeaders) {
    if (!hasAgentSecret()) return missingSecretResponse();
    const auth = await requireSignedAuth(authRequest);
    if (!auth.ok) return unauthorizedResponse();
    authMode = "agent_api";
  } else {
    const signature = body.signature;
    const timestamp = Number(body.timestamp);
    const nonce = body.nonce?.trim();
    const requesterRaw = body.requester?.trim().toLowerCase();

    if (
      !signature ||
      !nonce ||
      !requesterRaw ||
      !isAddress(requesterRaw) ||
      !Number.isFinite(timestamp) ||
      Math.abs(Date.now() - timestamp) > MAX_CLOCK_SKEW_MS
    ) {
      return NextResponse.json(
        { error: "Unauthorized. Provide wallet signature or agent API auth." },
        { status: 401 }
      );
    }
    idempotencyKey = `eoa:${requesterRaw}:${nonce}`;
    const remembered = getRememberedExecution(idempotencyKey);
    if (remembered) {
      return NextResponse.json({ ...remembered, idempotent: true });
    }
    if (!(await consumeEoaNonce({ scope: "remittance-execute", signer: requesterRaw, nonce, timestamp }))) {
      return NextResponse.json(
        {
          error: "Expired or replayed signature nonce",
          retryable: false,
          nextStep: "Create a fresh signature and retry.",
        },
        { status: 401 }
      );
    }

    const recipientInput = recipientAddress.trim().toLowerCase();
    const message = [
      "CeloFX Remittance Execute",
      `requester:${requesterRaw}`,
      `recipient:${recipientInput}`,
      `fromToken:${fromToken}`,
      `toToken:${toToken}`,
      `amount:${amount}`,
      `corridor:${corridor ?? `${fromToken} -> ${toToken}`}`,
      `nonce:${nonce}`,
      `timestamp:${timestamp}`,
    ].join("\n");

    try {
      const recovered = await recoverMessageAddress({
        message,
        signature: signature as `0x${string}`,
      });
      if (recovered.toLowerCase() !== requesterRaw) return unauthorizedResponse();
      requester = requesterRaw;
      authMode = "eoa_signed";
    } catch {
      return unauthorizedResponse();
    }
  }

  try {
    let pk: Hex | undefined;
    let executionWalletAddress: `0x${string}` | null = null;
    if (authMode === "eoa_signed" && requester) {
      const derived = deriveUserAgentWallet(requester);
      pk = derived.privateKey;
      executionWalletAddress = derived.address;
    } else {
      pk = process.env.AGENT_PRIVATE_KEY as Hex | undefined;
      executionWalletAddress = null;
    }

    if (!pk) {
      return NextResponse.json(
        { error: "Execution wallet not configured" },
        { status: 503 }
      );
    }

    const account = privateKeyToAccount(pk);
    const wallet = createCeloWalletClient(account);
    const publicClient = createCeloPublicClient();

    const walletAddress = executionWalletAddress ?? account.address;
    const [fromBal, gasBal] = await Promise.all([
      publicClient.readContract({
        address: TOKENS[fromToken] as `0x${string}`,
        abi: erc20BalanceAbi,
        functionName: "balanceOf",
        args: [walletAddress],
      }),
      publicClient.readContract({
        address: CUSD,
        abi: erc20BalanceAbi,
        functionName: "balanceOf",
        args: [walletAddress],
      }),
    ]);

    const fromTokenBalance = Number(formatUnits(fromBal, 18));
    const gasBuffer = Number(formatUnits(gasBal, 18));
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    if (fromTokenBalance < amountNum) {
      return NextResponse.json(
        {
          error: `Insufficient ${fromToken} balance in execution wallet`,
          retryable: false,
          code: "INSUFFICIENT_BALANCE",
          nextStep: `Fund ${walletAddress} with at least ${amountNum.toFixed(6)} ${fromToken}.`,
          executionWallet: walletAddress,
          balance: fromTokenBalance.toFixed(6),
          required: amountNum.toFixed(6),
        },
        { status: 400 }
      );
    }
    if (gasBuffer < MIN_GAS_BUFFER_CUSD) {
      return NextResponse.json(
        {
          error: "Insufficient cUSD gas buffer in execution wallet",
          retryable: false,
          code: "INSUFFICIENT_GAS_BUFFER",
          nextStep: `Fund ${walletAddress} with at least ${MIN_GAS_BUFFER_CUSD.toFixed(3)} cUSD for gas.`,
          executionWallet: walletAddress,
          cUSDBalance: gasBuffer.toFixed(6),
          minRequired: MIN_GAS_BUFFER_CUSD.toFixed(3),
        },
        { status: 400 }
      );
    }

    let approvalTxHash: Hex | null = null;
    let swapTxHash: Hex | null = null;
    let deliveredAmount = amount;

    if (fromToken !== toToken) {
      const swap = await buildSwapTx(fromToken, toToken, amount, slippage);

      approvalTxHash = await wallet.sendTransaction({
        to: swap.approvalTx.to,
        data: swap.approvalTx.data as `0x${string}`,
        feeCurrency: CUSD,
      });
      await publicClient.waitForTransactionReceipt({ hash: approvalTxHash });

      swapTxHash = await wallet.sendTransaction({
        to: swap.swapTx.to,
        data: swap.swapTx.data as `0x${string}`,
        feeCurrency: CUSD,
      });
      await publicClient.waitForTransactionReceipt({ hash: swapTxHash });

      deliveredAmount = swap.summary.expectedOut;
    }

    const transferTx = buildTransferTx(toToken, resolvedRecipient, deliveredAmount);
    const transferTxHash = await wallet.sendTransaction({
      to: transferTx.to,
      data: transferTx.data as `0x${string}`,
      feeCurrency: CUSD,
    });
    await publicClient.waitForTransactionReceipt({ hash: transferTxHash });

    const responsePayload: Record<string, unknown> = {
      success: true,
      mode: "agentic",
      authMode,
      requester,
      executionWallet: walletAddress,
      corridor: corridor ?? `${fromToken} -> ${toToken}`,
      fromToken,
      toToken,
      amountIn: amount,
      amountDelivered: deliveredAmount,
      recipientAddress: resolvedRecipient,
      recipientInput: recipientAddress,
      approvalTxHash,
      swapTxHash,
      transferTxHash,
    };
    if (idempotencyKey) {
      rememberExecution(idempotencyKey, responsePayload);
    }
    return NextResponse.json(responsePayload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Execution failed";
    const retryable =
      /timeout|network|fetch failed|503|502|gateway|temporarily|rpc/i.test(message);
    return NextResponse.json(
      {
        error: message,
        retryable,
        nextStep: retryable
          ? "Retry in a few seconds. If it persists, check RPC/network health."
          : "Review wallet balance, recipient, and quote, then retry with a fresh signature.",
      },
      { status: 500 }
    );
  }
}
