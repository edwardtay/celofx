import Link from "next/link";
import { ArrowRight, ShieldCheck, Workflow, Wallet } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

const modules = [
  {
    title: "Arbitrage",
    href: "/arbitrage",
    summary: "Live Mento and forex spread monitoring with execution logic and on-chain traceability.",
  },
  {
    title: "Trading",
    href: "/trading",
    summary: "Create and manage smart FX orders with live market execution and tracking.",
  },
  {
    title: "Hedging",
    href: "/hedge",
    summary: "Portfolio allocation and rebalance controls across Celo stablecoins.",
  },
  {
    title: "Remittance",
    href: "/remittance",
    summary: "Stablecoin transfers with recipient controls, history, and recurring payment flows.",
  },
  {
    title: "x402 Premium",
    href: "/premium",
    summary: "Pay-per-request premium signal endpoint with HTTP 402 payment flow.",
  },
  {
    title: "Developers",
    href: "/developers",
    summary: "MCP, A2A, API, and x402 integration docs with ready-to-use endpoint examples.",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8 space-y-8">
        <section className="rounded-xl border bg-card p-6 sm:p-8">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">CeloFX</p>
          <h1 className="mt-2 text-3xl font-display tracking-tight sm:text-4xl">
            Autonomous FX agent for Celo stablecoins
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground sm:text-base">
            CeloFX watches on-chain Mento rates versus off-chain FX references, identifies profitable spreads,
            and executes only when policy and risk checks pass. It also exposes agent protocols for other apps
            through MCP, A2A, and REST.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border px-3 py-1">ERC-8004</span>
            <span className="rounded-full border px-3 py-1">MCP + A2A + OASF</span>
            <span className="rounded-full border px-3 py-1">x402 Premium API</span>
            <span className="rounded-full border px-3 py-1">Celo Mainnet</span>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {modules.map((module) => (
            <Link
              key={module.title}
              href={module.href}
              className="rounded-xl border bg-card p-5 transition-colors hover:bg-accent/40"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{module.title}</h2>
                <ArrowRight className="size-4 text-muted-foreground" />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{module.summary}</p>
            </Link>
          ))}
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border bg-card p-5">
            <Workflow className="size-5 text-muted-foreground" />
            <h3 className="mt-3 font-semibold">Execution Logic</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Orders execute only when spread and policy thresholds are satisfied.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <ShieldCheck className="size-5 text-muted-foreground" />
            <h3 className="mt-3 font-semibold">Risk Guardrails</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Volume limits, validation checks, and auditable decisions before swap execution.
            </p>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <Wallet className="size-5 text-muted-foreground" />
            <h3 className="mt-3 font-semibold">On-Chain Verifiability</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Trade outputs and agent identity are externally verifiable on Celo.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
