import { NextResponse } from "next/server";
import {
  getPortfolioComposition,
  getTargetAllocation,
  setTargetAllocation,
  type TokenAllocation,
} from "@/lib/portfolio-config";
import type { MentoToken } from "@/lib/mento-sdk";

export async function GET(request: Request) {
  try {
    // Allow custom allocation via query params: ?cUSD=50&cEUR=30&cREAL=20
    const { searchParams } = new URL(request.url);
    const customCusd = searchParams.get("cUSD");
    const customCeur = searchParams.get("cEUR");
    const customCreal = searchParams.get("cREAL");

    if (customCusd && customCeur && customCreal) {
      const alloc: TokenAllocation[] = [
        { token: "cUSD" as MentoToken, targetPct: Number(customCusd) },
        { token: "cEUR" as MentoToken, targetPct: Number(customCeur) },
        { token: "cREAL" as MentoToken, targetPct: Number(customCreal) },
      ];
      const total = alloc.reduce((s, a) => s + a.targetPct, 0);
      if (Math.abs(total - 100) > 1) {
        return NextResponse.json(
          { error: `Allocation must sum to 100%, got ${total}%` },
          { status: 400 }
        );
      }
      setTargetAllocation(alloc);
    }

    const composition = await getPortfolioComposition();
    const targetAllocation = getTargetAllocation();

    return NextResponse.json({
      ...composition,
      targetAllocation,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch portfolio" },
      { status: 500 }
    );
  }
}
