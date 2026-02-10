import { NextRequest, NextResponse } from "next/server";
import { settlePayment, facilitator } from "thirdweb/x402";
import { createThirdwebClient } from "thirdweb";
import { defineChain } from "thirdweb/chains";
import { getPremiumSignals } from "@/lib/signal-store";
import type { MarketType } from "@/lib/types";

const payTo = (process.env.AGENT_WALLET_ADDRESS?.trim() ||
  "0x1e67A381c93F34afAed8c1A7E5E35746f8bE2b23") as `0x${string}`;

// Celo Mainnet
const celo = defineChain(42220);

// Thirdweb client for x402 facilitator
const thirdwebSecretKey = process.env.THIRDWEB_SECRET_KEY;

function getThirdwebFacilitator() {
  if (!thirdwebSecretKey) return null;
  const client = createThirdwebClient({ secretKey: thirdwebSecretKey });
  return facilitator({ client, serverWalletAddress: payTo });
}

export async function GET(request: NextRequest) {
  const paymentData = request.headers.get("x-payment");
  const thirdwebFacilitator = getThirdwebFacilitator();

  // Use thirdweb settlePayment if configured
  if (thirdwebFacilitator) {
    const result = await settlePayment({
      resourceUrl: `${request.nextUrl.origin}/api/premium-signals`,
      method: "GET",
      paymentData,
      payTo,
      network: celo,
      price: "$0.01",
      facilitator: thirdwebFacilitator,
      routeConfig: {
        description:
          "Access premium FX trading signals with entry/exit prices and detailed reasoning",
        mimeType: "application/json",
        maxTimeoutSeconds: 300,
      },
    });

    if (result.status === 200) {
      const market = request.nextUrl.searchParams.get(
        "market"
      ) as MarketType | null;
      const signals = getPremiumSignals(market ?? undefined);
      return NextResponse.json(signals, {
        headers: result.responseHeaders,
      });
    }

    return new NextResponse(JSON.stringify(result.responseBody), {
      status: result.status,
      headers: result.responseHeaders,
    });
  }

  // Fallback: manual x402 handling (no thirdweb key)
  const { encodePaymentRequiredHeader, decodePaymentSignatureHeader } =
    await import("@x402/core/http");

  if (!paymentData) {
    const paymentRequired = {
      x402Version: 2,
      resource: {
        url: "/api/premium-signals",
        description:
          "Access premium FX trading signals with entry/exit prices and detailed reasoning",
        mimeType: "application/json",
      },
      accepts: [
        {
          scheme: "exact",
          network: "eip155:42220" as const,
          asset: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
          amount: "10000",
          payTo,
          maxTimeoutSeconds: 300,
          extra: {},
        },
      ],
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

  try {
    const payload = decodePaymentSignatureHeader(paymentData);
    if (
      payload.x402Version &&
      payload.payload &&
      payload.accepted?.network === "eip155:42220"
    ) {
      const market = request.nextUrl.searchParams.get(
        "market"
      ) as MarketType | null;
      const signals = getPremiumSignals(market ?? undefined);
      return NextResponse.json(signals);
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
