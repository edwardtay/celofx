import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { chain, fromToken, toToken, amount, wallet } = body;

  const { callMoonPayTool, extractMcpText } = await import("@/lib/moonpay-mcp");
  const result = await callMoonPayTool("token_swap", {
    wallet: wallet || "celofx",
    chain: chain || "base",
    from: { token: fromToken, amount },
    to: { token: toToken, amount: null },
  });

  return NextResponse.json({
    ...JSON.parse(extractMcpText(result)),
    via: "moonpay-cli-mcp",
  });
}
