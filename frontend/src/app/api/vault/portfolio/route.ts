import { NextResponse } from "next/server";
import { getPortfolioComposition, getTargetAllocation } from "@/lib/portfolio-config";

export async function GET() {
  try {
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
