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
        "analytical_skills/mathematical_reasoning",
        "analytical_skills/data_analysis",
        "tool_interaction/api_integration",
        "tool_interaction/blockchain_interaction",
        "advanced_reasoning_planning/strategic_planning",
        "advanced_reasoning_planning/risk_assessment",
      ],
      domains: [
        "finance_and_business/investment_services",
        "finance_and_business/foreign_exchange",
        "finance_and_business/risk_management",
        "technology/blockchain",
        "technology/defi",
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
