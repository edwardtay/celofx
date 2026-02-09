import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Agent #4 | AAA",
  description:
    "On-chain identity and reputation for Agent #4 via ERC-8004 on Celo. View verified feedbacks, signal accuracy, and agent metadata.",
};

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
