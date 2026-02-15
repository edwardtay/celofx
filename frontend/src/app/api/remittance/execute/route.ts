import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo, mainnet } from "viem/chains";
import { buildSwapTx, buildTransferTx, type MentoToken } from "@/lib/mento-sdk";
import { hasAgentSecret, requireSignedAuth, unauthorizedResponse, missingSecretResponse } from "@/lib/auth";
import { recoverMessageAddress } from "viem";

const CUSD = "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const;
const FORNO = "https://forno.celo.org";
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

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
};

function isAddress(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

async function resolveRecipientAddress(input: string): Promise<`0x${string}` | null> {
  const raw = input.trim();
  if (isAddress(raw)) return raw;
  if (!raw.includes(".")) return null;

  try {
    const ensClient = createPublicClient({
      chain: mainnet,
      transport: http("https://cloudflare-eth.com"),
    });
    const resolved = await ensClient.getEnsAddress({ name: raw as `${string}.eth` });
    return resolved ?? null;
  } catch {
    return null;
  }
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

  if (hasAgentHeaders) {
    if (!hasAgentSecret()) return missingSecretResponse();
    const auth = await requireSignedAuth(authRequest);
    if (!auth.ok) return unauthorizedResponse();
    authMode = "agent_api";
  } else {
    const signature = body.signature;
    const timestamp = Number(body.timestamp);
    const requesterRaw = body.requester?.trim().toLowerCase();

    if (
      !signature ||
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

    const recipientInput = recipientAddress.trim().toLowerCase();
    const message = [
      "CeloFX Remittance Execute",
      `requester:${requesterRaw}`,
      `recipient:${recipientInput}`,
      `fromToken:${fromToken}`,
      `toToken:${toToken}`,
      `amount:${amount}`,
      `corridor:${corridor ?? `${fromToken} -> ${toToken}`}`,
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

  const pk = process.env.AGENT_PRIVATE_KEY as Hex | undefined;
  if (!pk) {
    return NextResponse.json(
      { error: "AGENT_PRIVATE_KEY is not configured for agentic execution" },
      { status: 503 }
    );
  }

  try {
    const account = privateKeyToAccount(pk);
    const wallet = createWalletClient({
      account,
      chain: celo,
      transport: http(FORNO),
    });
    const publicClient = createPublicClient({
      chain: celo,
      transport: http(FORNO),
    });

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

    return NextResponse.json({
      success: true,
      mode: "agentic",
      authMode,
      requester,
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
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Execution failed" },
      { status: 500 }
    );
  }
}
