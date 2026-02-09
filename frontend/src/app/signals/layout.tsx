import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Signals | AAA",
  description:
    "AI-generated trading signals across crypto, stocks, forex, and commodities. Powered by Claude AI, verified on-chain via ERC-8004.",
};

export default function SignalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
