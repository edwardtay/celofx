import { NextRequest, NextResponse } from "next/server";
import { getDynamicSpreadThreshold } from "@/lib/agent-policy";

export async function GET(request: NextRequest) {
  const amountRaw = request.nextUrl.searchParams.get("amount") ?? "25";
  const amount = Number(amountRaw);

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "Invalid amount. Use a positive number, e.g. /api/agent/profitability?amount=25" },
      { status: 400 }
    );
  }

  const threshold = await getDynamicSpreadThreshold(amount);
  const impliedMinProfitUsd = (amount * threshold.requiredSpreadPct) / 100;

  return NextResponse.json({
    amountUsd: amount,
    formula: "requiredSpreadPct = max(0.1%, gas/notional + 0.04%, $0.03/notional)",
    requiredSpreadPct: threshold.requiredSpreadPct,
    impliedMinProfitUsd: +impliedMinProfitUsd.toFixed(6),
    thresholdBreakdown: threshold,
    notes: [
      "0.1% is the policy floor (base edge).",
      "gas/notional scales the required spread for smaller trades.",
      "0.04% = 0.02% slippage buffer + 0.02% safety margin.",
      "$0.03/notional enforces a minimum absolute expected profit.",
    ],
  });
}
