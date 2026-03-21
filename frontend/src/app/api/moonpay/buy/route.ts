import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const amount = params.get("amount") || "50";
  const token = params.get("token") || "usdc_base";
  const wallet = params.get("wallet") || "0x6652AcDc623b7CCd52E115161d84b949bAf3a303";
  const email = params.get("email");

  const checkoutParams = new URLSearchParams({
    apiKey: "pk_live_j75GIyb0XhROmgv6kNjXkWcBRmslbs",
    currencyCode: token,
    baseCurrencyAmount: amount,
    walletAddress: wallet,
    colorCode: "%23D4A843",
    theme: "dark",
  });
  if (email) checkoutParams.set("email", email);

  const checkoutUrl = `https://buy.moonpay.com?${checkoutParams.toString()}`;

  return NextResponse.json({
    checkoutUrl,
    token,
    amountUsd: parseFloat(amount),
    wallet,
    supportedTokens: [
      { code: "usdc_base", name: "USDC on Base", chain: "base" },
      { code: "usdc", name: "USDC on Ethereum", chain: "ethereum" },
      { code: "usdc_polygon", name: "USDC on Polygon", chain: "polygon" },
      { code: "usdc_arbitrum", name: "USDC on Arbitrum", chain: "arbitrum" },
      { code: "eth", name: "ETH", chain: "ethereum" },
      { code: "eth_base", name: "ETH on Base", chain: "base" },
    ],
    flow: "User completes payment in browser → crypto sent to wallet → bridge to Celo → agent trades via Mento",
    moonpayIntegration: "MoonPay CLI MCP Server (97 tools)",
  });
}
