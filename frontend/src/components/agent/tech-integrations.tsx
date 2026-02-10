"use client";

import { ExternalLink } from "lucide-react";

const integrations = [
  {
    name: "ERC-8004",
    desc: "Agent identity + reputation registry",
    detail: "FX Arbitrage Agent registered with on-chain metadata, 5 reputation feedbacks stored permanently",
    link: "https://celoscan.io/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432",
    color: "border-l-emerald-500",
  },
  {
    name: "x402 via thirdweb",
    desc: "HTTP 402 micropayments for premium signals",
    detail: "thirdweb settlePayment() facilitator + $0.01 cUSD via EIP-712 on Celo — no gas fees",
    link: "https://portal.thirdweb.com/x402",
    color: "border-l-blue-500",
  },
  {
    name: "Mento Broker",
    desc: "On-chain stablecoin swap execution",
    detail: "getAmountOut() for quotes, swapIn() for execution — real protocol rates, not CoinGecko",
    link: "https://celoscan.io/address/0x777A8255cA72412f0d706dc03C9D1987306B4CaD",
    color: "border-l-amber-500",
  },
  {
    name: "Fee Abstraction",
    desc: "Gas fees paid in cUSD via CIP-64",
    detail: "Agent swaps pay zero CELO — feeCurrency param routes gas fees through cUSD on every tx",
    link: "https://docs.celo.org/developer/fee-currency",
    color: "border-l-cyan-500",
  },
  {
    name: "Claude AI",
    desc: "Agentic loop with 7 tools, max 10 iterations",
    detail: "Claude Sonnet 4.5 orchestrates market analysis, signal generation, and swap execution autonomously",
    link: "https://docs.anthropic.com/en/docs/build-with-claude/tool-use",
    color: "border-l-violet-500",
  },
];

export function TechIntegrations() {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Deep Integrations</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {integrations.map((tech) => (
          <div
            key={tech.name}
            className={`border rounded-lg border-l-4 p-3 space-y-1 ${tech.color}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{tech.name}</span>
              <a
                href={tech.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="size-3" />
              </a>
            </div>
            <p className="text-xs text-muted-foreground">{tech.desc}</p>
            <p className="text-[10px] text-muted-foreground/80">{tech.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
