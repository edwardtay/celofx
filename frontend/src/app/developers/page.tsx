"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import {
  Terminal,
  Plug,
  Copy,
  Check,
  Play,
  Globe,
  Bot,
  CreditCard,
  Rocket,
} from "lucide-react";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://celofx.vercel.app";

type TabKey = "quickstart" | "mcp" | "a2a" | "rest" | "x402";

const TABS: { key: TabKey; label: string; icon: typeof Terminal; desc: string }[] = [
  { key: "quickstart", label: "Quickstart", icon: Rocket, desc: "Get started in 60 seconds" },
  { key: "mcp", label: "MCP", icon: Plug, desc: "Model Context Protocol" },
  { key: "a2a", label: "A2A", icon: Bot, desc: "Agent-to-Agent protocol" },
  { key: "rest", label: "REST API", icon: Globe, desc: "Standard HTTP endpoints" },
  { key: "x402", label: "x402", icon: CreditCard, desc: "Micropayment signals" },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </button>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative">
      <CopyButton text={code} />
      <pre className="bg-zinc-950 text-zinc-300 rounded-lg p-4 text-xs font-mono overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function LiveEndpoint({ url, label }: { url: string; label: string }) {
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function tryIt() {
    setLoading(true);
    try {
      const res = await fetch(url);
      const data = await res.json();
      setResponse(JSON.stringify(data, null, 2).slice(0, 800));
    } catch {
      setResponse("Error fetching endpoint");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <code className="text-xs font-mono bg-muted px-2 py-1 rounded">{label}</code>
        <button
          onClick={tryIt}
          disabled={loading}
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline disabled:opacity-50"
        >
          <Play className="size-3" />
          {loading ? "Loading..." : "Try it"}
        </button>
      </div>
      {response && (
        <pre className="bg-zinc-950 text-emerald-400 rounded-lg p-3 text-[11px] font-mono overflow-x-auto max-h-48 overflow-y-auto">
          {response}
        </pre>
      )}
    </div>
  );
}

function QuickstartTab() {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium mb-1">Get CeloFX data in 60 seconds</h3>
        <p className="text-xs text-muted-foreground">
          No API key, no SDK, no auth. Pick one integration path below and go live quickly.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="border rounded-lg p-3 space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">Fastest</Badge>
            <p className="text-xs font-medium">MCP</p>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Connect AI clients to CeloFX tools for rates, signals, and performance.
          </p>
        </div>
        <div className="border rounded-lg p-3 space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">Inter-agent</Badge>
            <p className="text-xs font-medium">A2A</p>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Discover capabilities via agent card and send tasks over JSON-RPC.
          </p>
        </div>
        <div className="border rounded-lg p-3 space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">Simple</Badge>
            <p className="text-xs font-medium">REST API</p>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Fetch CeloFX-native on-chain FX spreads, market data, signals, and track record via HTTP.
          </p>
        </div>
        <div className="border rounded-lg p-3 space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">Monetize</Badge>
            <p className="text-xs font-medium">x402</p>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Gate premium signal responses behind pay-per-request micropayments.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium">Smoke test live data</p>
        <CodeBlock code={`curl ${BASE_URL}/api/market-data/mento | jq '.pairs[0]'`} />
      </div>

      <LiveEndpoint url={`${BASE_URL}/api/market-data/mento`} label="Try it: GET /api/market-data/mento" />
    </div>
  );
}

function McpTab() {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-medium mb-1">Model Context Protocol</h3>
        <p className="text-xs text-muted-foreground">
          5 tools available. Any MCP client (Claude Desktop, Cursor, custom agents) can connect.
        </p>
      </div>

      <div>
        <p className="text-xs font-medium mb-2">MCP config</p>
        <CodeBlock
          code={`{
  "mcpServers": {
    "celofx": {
      "url": "${BASE_URL}/api/mcp"
    }
  }
}`}
        />
      </div>

      <div>
        <p className="text-xs font-medium mb-2">Tools</p>
        <div className="space-y-2">
          {[
            { name: "get_mento_rates", desc: "Live on-chain Celo stablecoin rates vs real forex — spread analysis", returns: "pairs[]: { pair, mentoRate, forexRate, spreadPct, direction }" },
            { name: "get_signals", desc: "AI-generated trading signals (filter by market)", returns: "signals[]: { asset, market, direction, confidence, summary, reasoning }" },
            { name: "get_trades", desc: "Executed on-chain swaps with Celoscan tx hashes", returns: "trades[]: { pair, amountIn, amountOut, rate, spreadPct, celoscanUrl }" },
            { name: "get_performance", desc: "Verified track record: volume, P&L, success rate", returns: "{ totalTrades, successRate, totalVolume, avgSpreadCaptured, cumulativePnlPct }" },
            { name: "get_agent_info", desc: "Agent identity, protocols, capabilities", returns: "{ agentId, wallet, chain, protocols: { mcp, a2a, x402 }, tee }" },
          ].map((tool) => (
            <div key={tool.name} className="border rounded-lg p-3 space-y-1">
              <code className="text-xs font-mono font-medium">{tool.name}</code>
              <p className="text-[11px] text-muted-foreground">{tool.desc}</p>
              <p className="text-[10px] font-mono text-muted-foreground/70">Returns: {tool.returns}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium mb-2">Test with curl</p>
        <CodeBlock
          code={`# Initialize
curl -X POST ${BASE_URL}/api/mcp \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'

# List tools
curl -X POST ${BASE_URL}/api/mcp \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'`}
        />
      </div>

      <LiveEndpoint url={`${BASE_URL}/api/mcp`} label="GET /api/mcp — server capabilities" />
    </div>
  );
}

function A2aTab() {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-medium mb-1">Agent-to-Agent Protocol (v0.3.0)</h3>
        <p className="text-xs text-muted-foreground">
          Discover capabilities via agent card, send tasks via JSON-RPC.
        </p>
      </div>

      <div>
        <p className="text-xs font-medium mb-2">1. Discover</p>
        <CodeBlock
          code={`curl ${BASE_URL}/.well-known/agent-card.json | jq .`}
        />
        <LiveEndpoint url={`${BASE_URL}/.well-known/agent-card.json`} label="GET /.well-known/agent-card.json" />
      </div>

      <div>
        <p className="text-xs font-medium mb-2">2. Send a task</p>
        <CodeBlock
          code={`curl -X POST ${BASE_URL}/api/a2a \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "message/send",
    "params": {
      "message": {
        "role": "user",
        "parts": [{"type": "text", "text": "What are the current Mento cUSD/cEUR rates vs forex?"}]
      }
    }
  }'`}
        />
      </div>

      <div>
        <p className="text-xs font-medium mb-2">3. Skills</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { name: "FX Rate Analysis", desc: "Compare on-chain Celo stablecoin rates with real forex", id: "fx_rate_analysis" },
            { name: "Swap Execution", desc: "Execute native Celo stablecoin swaps", id: "execute_swap" },
            { name: "Portfolio Status", desc: "Agent wallet balances and trade history", id: "portfolio_status" },
            { name: "Performance", desc: "Verified track record with on-chain proof", id: "performance_tracking" },
          ].map((skill) => (
            <div key={skill.name} className="bg-muted/50 rounded-lg p-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium">{skill.name}</p>
                <code className="text-[9px] font-mono text-muted-foreground">{skill.id}</code>
              </div>
              <p className="text-[11px] text-muted-foreground">{skill.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RestTab() {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-medium mb-1">REST API — no SDK, no auth</h3>
        <p className="text-xs text-muted-foreground">
          Standard HTTP GET endpoints returning JSON. Build dashboards, alerts, or feed data into your own agent.
        </p>
      </div>

      <div>
        <p className="text-xs font-medium mb-3">Endpoints</p>
        <div className="space-y-1">
          {[
            { method: "GET", path: "/api/market-data/mento", desc: "Native on-chain stablecoin rates vs forex (core data)" },
            { method: "GET", path: "/api/market-data/forex", desc: "Real-world forex rates (EUR, GBP, JPY, CHF)" },
            { method: "GET", path: "/api/market-data/crypto", desc: "Crypto prices (BTC, ETH, SOL, CELO)" },
            { method: "GET", path: "/api/signals", desc: "AI-generated trading signals" },
            { method: "GET", path: "/api/trades", desc: "Executed swaps with Celoscan tx hashes" },
            { method: "GET", path: "/api/agent/track-record", desc: "Verified performance metrics" },
            { method: "GET", path: "/api/tee/attestation", desc: "TEE attestation (Intel TDX)" },
            { method: "GET", path: "/api/health", desc: "Health check" },
          ].map((ep) => (
            <div key={ep.path} className="flex items-center gap-2 text-xs py-1 border-b border-border/30">
              <code className="font-mono bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded text-[10px] shrink-0">{ep.method}</code>
              <code className="font-mono shrink-0">{ep.path}</code>
              <span className="text-muted-foreground truncate">{ep.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium">Try live</p>
        <LiveEndpoint url={`${BASE_URL}/api/market-data/mento`} label="GET /api/market-data/mento" />
      </div>

    </div>
  );
}

function X402Tab() {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-medium mb-1">x402 Micropayments — $0.10 per signal</h3>
        <p className="text-xs text-muted-foreground">
          Premium signals behind HTTP 402. No subscription, no account — just sign and pay.
        </p>
      </div>

      <div>
        <p className="text-xs font-medium mb-2">Flow</p>
        <div className="space-y-1.5">
          {[
            { step: "1", text: "GET /api/premium-signals → HTTP 402 + payment requirements" },
            { step: "2", text: "Client signs EIP-712 payment (0.10 cUSD)" },
            { step: "3", text: "Retry with X-PAYMENT header → 200 + premium data" },
          ].map((s) => (
            <div key={s.step} className="flex items-start gap-2 text-xs">
              <span className="bg-muted rounded-full size-5 flex items-center justify-center shrink-0 font-mono text-[10px]">
                {s.step}
              </span>
              <span className="text-muted-foreground">{s.text}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium mb-2">Test</p>
        <CodeBlock
          code={`# Returns 402 with payment requirements
curl -I ${BASE_URL}/api/premium-signals

# Headers:
# X-Payment-Required: true
# X-Payment-Amount: 100000  (0.10 cUSD, 6 decimals)
# X-Payment-Token: 0x765DE816845861e75A25fCA122bb6898B8B1282a`}
        />
      </div>

      <div>
        <p className="text-xs font-medium mb-2">Integrate with Thirdweb</p>
        <CodeBlock
          code={`import { createThirdwebClient } from "thirdweb";
import { payWith402 } from "thirdweb/extensions/x402";

const client = createThirdwebClient({ clientId: "..." });

// Handles 402 → sign → retry automatically
const signals = await payWith402({
  client,
  url: "${BASE_URL}/api/premium-signals",
  chain: celo,
});`}
        />
      </div>

      <LiveEndpoint url={`${BASE_URL}/api/premium-signals`} label="GET /api/premium-signals — returns 402" />
    </div>
  );
}

export default function DevelopersPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("quickstart");

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 px-6 py-6 max-w-4xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-2xl font-display tracking-tight">Developers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Integrate CeloFX into your agent, app, or workflow. Four protocols, zero vendor lock-in.
          </p>
        </div>

        {/* Protocol cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`text-left rounded-lg border p-2.5 transition-colors ${
                activeTab === tab.key
                  ? "border-foreground bg-accent"
                  : "border-border hover:bg-accent/50"
              }`}
            >
              <tab.icon className={`size-3.5 mb-1 ${activeTab === tab.key ? "text-foreground" : "text-muted-foreground"}`} />
              <p className="text-xs font-medium">{tab.label}</p>
              <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{tab.desc}</p>
            </button>
          ))}
        </div>

        {/* Active tab content */}
        <Card>
          <CardContent className="p-5">
            {activeTab === "quickstart" && <QuickstartTab />}
            {activeTab === "mcp" && <McpTab />}
            {activeTab === "a2a" && <A2aTab />}
            {activeTab === "rest" && <RestTab />}
            {activeTab === "x402" && <X402Tab />}
          </CardContent>
        </Card>

        {/* Standards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "MCP", version: "2025-06-18", status: "Live" },
            { label: "A2A", version: "v0.3.0", status: "Live" },
            { label: "x402", version: "EIP-712", status: "Live" },
            { label: "ERC-8004", version: "Agent #10", status: "On-chain" },
          ].map((s) => (
            <div key={s.label} className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-sm font-medium">{s.label}</p>
              <p className="text-[11px] text-muted-foreground">{s.version}</p>
              <Badge variant="outline" className="mt-1.5 text-[10px]">{s.status}</Badge>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
