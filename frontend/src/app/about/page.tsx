import { Navbar } from "@/components/navbar";
import { ExternalLink } from "lucide-react";

const links = [
  { label: "Identity Registry", href: "https://celoscan.io/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432", external: true },
  { label: "Reputation Registry", href: "https://celoscan.io/address/0x8004BAa17C55a88189AE136b182e5fdA19dE9b63", external: true },
  { label: "Decision Registry", href: "https://celoscan.io/address/0xF8faC012318671b6694732939bcB6EA8d2c91662", external: true },
  { label: "Agent Wallet", href: "https://celoscan.io/address/0x6652AcDc623b7CCd52E115161d84b949bAf3a303", external: true },
  { label: "8004scan", href: "https://www.8004scan.io/agents/celo/10", external: true },
  { label: "GitHub", href: "https://github.com/edwardtay/celofx", external: true },
  { label: "Track Record API", href: "/api/agent/track-record", external: false },
  { label: "OpenAPI Spec", href: "/api/openapi.json", external: false },
  { label: "Agent Metadata", href: "/agent-metadata-v2.json", external: false },
  { label: "Skill.md", href: "/skill.md", external: false },
  { label: "MCP Server", href: "/api/mcp", external: false },
  { label: "A2A Agent Card", href: "/.well-known/agent-card.json", external: false },
  { label: "Developers", href: "/developers", external: false },
];

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-display tracking-tight">About</h1>
          <p className="text-sm text-muted-foreground mt-2">
            CeloFX is an autonomous FX arbitrage agent (ERC-8004 #10) on Celo.
            It monitors Mento Broker and Uniswap V3 rates against real forex,
            executes profitable swaps, and exposes its capabilities via MCP, A2A, x402, and REST.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noopener noreferrer" : undefined}
              className="flex items-center justify-between py-2.5 border-b border-border/30 text-sm hover:text-foreground text-muted-foreground transition-colors group"
            >
              {link.label}
              {link.external ? (
                <ExternalLink className="size-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              ) : (
                <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">→</span>
              )}
            </a>
          ))}
        </div>

        <div className="space-y-3 text-xs text-muted-foreground">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-[9px] uppercase tracking-widest mb-1">Agent ID</p>
              <p className="font-mono">10</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest mb-1">Chain</p>
              <p className="font-mono">Celo (42220)</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest mb-1">Model</p>
              <p className="font-mono">Kimi K2.5</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest mb-1">Protocols</p>
              <p className="font-mono">MCP A2A x402 OASF</p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-border mt-auto">
        <div className="max-w-3xl mx-auto px-6 py-3 text-[10px] text-muted-foreground text-center">
          CeloFX is experimental software. Use at your own risk. Not financial advice.
        </div>
      </footer>
    </div>
  );
}
