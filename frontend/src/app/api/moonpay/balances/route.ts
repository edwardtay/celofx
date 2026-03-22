import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const wallet = params.get("wallet") || "0x6652AcDc623b7CCd52E115161d84b949bAf3a303";
  const chain = params.get("chain") || "ethereum";

  const { callMoonPayTool, extractMcpText } = await import("@/lib/moonpay-mcp");
  const result = await callMoonPayTool("token_balance_list", { wallet, chain });

  return NextResponse.json({
    ...JSON.parse(extractMcpText(result)),
    via: "moonpay-cli-mcp",
  });
}
