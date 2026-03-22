import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { fromChain, fromToken, amount, toChain, toToken } = body;

  const { callMoonPayTool, extractMcpText } = await import("@/lib/moonpay-mcp");
  const result = await callMoonPayTool("token_bridge", {
    from: { wallet: "celofx", chain: fromChain, token: fromToken, amount },
    to: {
      wallet: null,
      chain: toChain || "celo",
      token: toToken || "0x765DE816845861e75A25fCA122bb6898B8B1282a",
      amount: null,
    },
  });

  return NextResponse.json({
    ...JSON.parse(extractMcpText(result)),
    via: "moonpay-cli-mcp",
  });
}
