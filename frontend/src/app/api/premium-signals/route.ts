import { NextRequest, NextResponse } from "next/server";
import { settlePayment, facilitator } from "thirdweb/x402";
import { createThirdwebClient } from "thirdweb";
import { defineChain } from "thirdweb/chains";
import { getPremiumSignals } from "@/lib/signal-store";
import type { MarketType } from "@/lib/types";
import { getTeeHeaders } from "@/lib/tee";

const payTo = (process.env.AGENT_OWNER_ADDRESS?.trim() ||
  "0x6652AcDc623b7CCd52E115161d84b949bAf3a303") as `0x${string}`;

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
        headers: { ...result.responseHeaders, ...getTeeHeaders() },
      });
    }

    return new NextResponse(JSON.stringify(result.responseBody), {
      status: result.status,
      headers: { ...result.responseHeaders, ...getTeeHeaders() },
    });
  }

  // x402 payment verification requires thirdweb — no insecure fallback
  return NextResponse.json(
    {
      error: "Payment verification unavailable",
      message: "x402 payment requires THIRDWEB_SECRET_KEY to be configured for settlement verification",
    },
    { status: 503, headers: getTeeHeaders() }
  );
}
