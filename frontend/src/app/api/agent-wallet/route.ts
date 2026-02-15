import { NextResponse } from "next/server";
import { createPublicClient, http, formatUnits } from "viem";
import { celo } from "viem/chains";
import { recoverMessageAddress, isAddress } from "viem";
import { deriveUserAgentWallet } from "@/lib/user-agent-wallet";

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const CUSD = "0x765DE816845861e75A25fCA122bb6898B8B1282a" as const;
const FORNO = "https://forno.celo.org";

const erc20BalanceAbi = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export async function POST(request: Request) {
  let body: { requester?: string; signature?: string; timestamp?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const requester = body.requester?.trim().toLowerCase();
  const signature = body.signature;
  const timestamp = Number(body.timestamp);

  if (
    !requester ||
    !signature ||
    !Number.isFinite(timestamp) ||
    !isAddress(requester) ||
    Math.abs(Date.now() - timestamp) > MAX_CLOCK_SKEW_MS
  ) {
    return NextResponse.json({ error: "Invalid requester/signature/timestamp" }, { status: 400 });
  }

  const message = [
    "CeloFX Agent Wallet Access",
    `requester:${requester}`,
    `timestamp:${timestamp}`,
  ].join("\n");

  try {
    const recovered = await recoverMessageAddress({
      message,
      signature: signature as `0x${string}`,
    });
    if (recovered.toLowerCase() !== requester) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    const wallet = deriveUserAgentWallet(requester);
    const client = createPublicClient({ chain: celo, transport: http(FORNO) });
    const [cusdBal, celoBal] = await Promise.all([
      client.readContract({
        address: CUSD,
        abi: erc20BalanceAbi,
        functionName: "balanceOf",
        args: [wallet.address],
      }),
      client.getBalance({ address: wallet.address }),
    ]);

    return NextResponse.json({
      wallet: {
        address: wallet.address,
        source: wallet.source,
      },
      balances: {
        cUSD: formatUnits(cusdBal, 18),
        CELO: formatUnits(celoBal, 18),
      },
      fundingHint: {
        minSuggestedCusd: "0.20",
        note: "Fund this wallet with cUSD for swaps/transfers and CIP-64 gas on Celo.",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Wallet derivation failed" },
      { status: 500 }
    );
  }
}
