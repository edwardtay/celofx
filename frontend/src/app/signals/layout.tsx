import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Signals | CeloFX",
  description:
    "AI-generated FX signals and Mento stablecoin swap recommendations. Powered by Claude AI, verified on-chain via ERC-8004.",
};

export default function SignalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
