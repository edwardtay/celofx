import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Premium Signals | CeloFX",
  description:
    "Unlock premium trading signals with entry prices, targets, and stop losses. Pay $0.01 in cUSD via x402 protocol on Celo.",
};

export default function PremiumLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
