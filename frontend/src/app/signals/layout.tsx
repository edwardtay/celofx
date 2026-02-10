import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Signals | CeloFX",
  description:
    "AI-generated FX signals and Mento stablecoin swap recommendations. Cross-market analysis with on-chain execution.",
};

export default function SignalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
