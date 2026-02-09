import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trades | CeloFX",
  description:
    "Autonomous trade history. Every swap executed by the CeloFX agent with transaction links, rates, and P&L.",
};

export default function TradesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
