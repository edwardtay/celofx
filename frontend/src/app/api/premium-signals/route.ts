import { NextRequest, NextResponse } from "next/server";
import {
  encodePaymentRequiredHeader,
  decodePaymentSignatureHeader,
} from "@x402/core/http";
import { getPremiumSignals } from "@/lib/signal-store";
import type { MarketType } from "@/lib/types";

const payTo = (process.env.AGENT_WALLET_ADDRESS?.trim() ||
  "0x0000000000000000000000000000000000000001") as `0x${string}`;

// cUSD on Celo Mainnet
const CUSD_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a";

// x402 payment requirements for this endpoint
const paymentRequirements = {
  scheme: "exact",
  network: "eip155:42220" as const,
  asset: CUSD_ADDRESS,
  amount: "10000", // $0.01 in 6 decimal USDC/cUSD
  payTo,
  maxTimeoutSeconds: 300,
  extra: {},
};

const resourceInfo = {
  url: "/api/premium-signals",
  description:
    "Access premium alpha signals with entry/exit prices and detailed reasoning",
  mimeType: "application/json",
};

export async function GET(request: NextRequest) {
  // Check for x402 payment header
  const paymentHeader = request.headers.get("x-payment");

  if (!paymentHeader) {
    // Return 402 with payment requirements
    const paymentRequired = {
      x402Version: 2,
      resource: resourceInfo,
      accepts: [paymentRequirements],
    };

    const encoded = encodePaymentRequiredHeader(paymentRequired);

    return new NextResponse(JSON.stringify(paymentRequired), {
      status: 402,
      headers: {
        "Content-Type": "application/json",
        "X-PAYMENT-REQUIRED": encoded,
      },
    });
  }

  // Decode and verify payment payload
  try {
    const payload = decodePaymentSignatureHeader(paymentHeader);

    // Verify payment structure and Celo network match
    if (
      payload.x402Version &&
      payload.payload &&
      payload.accepted?.network === "eip155:42220"
    ) {
      const market = request.nextUrl.searchParams.get(
        "market"
      ) as MarketType | null;
      const signals = getPremiumSignals(market ?? undefined);

      return NextResponse.json(signals, {
        headers: {
          "X-PAYMENT-RESPONSE": JSON.stringify({
            success: true,
            network: "eip155:42220",
            settledAt: new Date().toISOString(),
          }),
        },
      });
    }

    return NextResponse.json(
      { error: "Invalid payment payload" },
      { status: 400 }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to decode payment" },
      { status: 400 }
    );
  }
}
