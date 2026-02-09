import { NextRequest, NextResponse } from "next/server";
import { getTrades } from "@/lib/trade-store";
import type { TradeStatus } from "@/lib/types";

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status") as TradeStatus | null;
  const trades = getTrades(status ?? undefined);
  return NextResponse.json(trades);
}
