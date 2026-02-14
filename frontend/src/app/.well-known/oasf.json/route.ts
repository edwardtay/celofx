import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      schema_version: "0.8.0",
      name: "CeloFX",
      description:
        "Autonomous FX arbitrage agent on Celo. Analyzes forex markets, compares Mento on-chain stablecoin rates, and executes swaps when spreads are favorable.",
      version: "1.0.0",
      skills: [
        { id: 501, name: "Mathematical Reasoning", category: "Analytical Skills" },
        { id: 1401, name: "API Schema Understanding", category: "Tool Interaction" },
        { id: 1402, name: "Workflow Automation", category: "Tool Interaction" },
        { id: 1501, name: "Strategic Planning", category: "Advanced Reasoning & Planning" },
        { id: 1504, name: "Hypothesis Generation", category: "Advanced Reasoning & Planning" },
      ],
      domains: [
        { id: 203, name: "Investment Services", category: "Finance and Business" },
        { id: 202, name: "Finance", category: "Finance and Business" },
        { id: 109, name: "Blockchain", category: "Technology" },
        { id: 10902, name: "Decentralized Finance (DeFi)", category: "Technology" },
        { id: 405, name: "Risk Management", category: "Trust and Safety" },
      ],
      capabilities: [
        "autonomous_execution",
        "on_chain_verification",
        "cross_market_analysis",
        "multi_venue_arbitrage",
        "portfolio_hedging",
        "gas_optimization",
      ],
      status: "active",
    },
    {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=300",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}
