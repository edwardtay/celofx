import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FX Arbitrage Agent | CeloFX",
  description:
    "On-chain identity and reputation for the FX Arbitrage Agent via ERC-8004 on Celo. View verified feedbacks, signal accuracy, and agent metadata.",
};

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
