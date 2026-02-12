"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import {
  Terminal,
  Plug,
  Zap,
  Copy,
  Check,
  ExternalLink,
  Play,
  Globe,
  Bot,
  CreditCard,
  FileJson,
} from "lucide-react";

const BASE_URL = "https://celofx.vercel.app";

type TabKey = "mcp" | "a2a" | "rest" | "x402";

const TABS: { key: TabKey; label: string; icon: typeof Terminal; desc: string }[] = [
  { key: "mcp", label: "MCP", icon: Plug, desc: "Model Context Protocol — connect any AI agent" },
  { key: "a2a", label: "A2A", icon: Bot, desc: "Agent-to-Agent protocol — task-based interaction" },
  { key: "rest", label: "REST API", icon: Globe, desc: "Standard HTTP endpoints — no SDK needed" },
  { key: "x402", label: "x402", icon: CreditCard, desc: "Micropayment-gated premium signals" },
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

function CodeBlock({ code, lang = "bash" }: { code: string; lang?: string }) {
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

function McpTab() {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-medium mb-1">Connect your AI agent to CeloFX</h3>
        <p className="text-xs text-muted-foreground">
          CeloFX exposes 5 MCP tools. Any MCP-compatible client (Claude Desktop, Cursor, custom agents) can connect and call them.
        </p>
      </div>

      <div>
        <p className="text-xs font-medium mb-2">1. Add to your MCP config</p>
        <CodeBlock
          lang="json"
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
        <p className="text-xs font-medium mb-2">2. Available tools</p>
        <div className="space-y-1.5">
          {[
            { name: "get_mento_rates", desc: "Live Mento on-chain rates vs real forex — spread analysis" },
            { name: "get_signals", desc: "AI-generated trading signals (filter by market)" },
            { name: "get_trades", desc: "Executed on-chain swaps with Celoscan tx hashes" },
            { name: "get_performance", desc: "Verified track record: volume, P&L, success rate" },
            { name: "get_agent_info", desc: "Agent identity, protocols, capabilities" },
          ].map((tool) => (
            <div key={tool.name} className="flex items-start gap-2 text-xs">
              <code className="font-mono bg-muted px-1.5 py-0.5 rounded shrink-0">{tool.name}</code>
              <span className="text-muted-foreground">{tool.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium mb-2">3. Test with curl</p>
        <CodeBlock
          code={`# Initialize MCP session
curl -X POST ${BASE_URL}/api/mcp \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}'

# List available tools
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
        <h3 className="text-sm font-medium mb-1">Agent-to-Agent communication</h3>
        <p className="text-xs text-muted-foreground">
          CeloFX implements the A2A protocol (v0.3.0). Other agents can discover capabilities via the agent card and send tasks.
        </p>
      </div>

      <div>
        <p className="text-xs font-medium mb-2">1. Discover agent capabilities</p>
        <CodeBlock
          code={`# Fetch the agent card
curl ${BASE_URL}/.well-known/agent-card.json | jq .`}
        />
        <LiveEndpoint url={`${BASE_URL}/.well-known/agent-card.json`} label="GET /.well-known/agent-card.json" />
      </div>

      <div>
        <p className="text-xs font-medium mb-2">2. Send a task</p>
        <CodeBlock
          code={`# Send a rate analysis task
curl -X POST ${BASE_URL}/api/a2a \\
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
        <p className="text-xs font-medium mb-2">3. Agent skills</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { name: "FX Rate Analysis", desc: "Compare Mento on-chain rates with real forex" },
            { name: "Swap Execution", desc: "Execute Mento stablecoin swaps on Celo" },
            { name: "Portfolio Status", desc: "Agent wallet balances and trade history" },
            { name: "Performance Tracking", desc: "Verified track record with on-chain proof" },
          ].map((skill) => (
            <div key={skill.name} className="bg-muted/50 rounded-lg p-2.5">
              <p className="text-xs font-medium">{skill.name}</p>
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
        <h3 className="text-sm font-medium mb-1">Public REST endpoints</h3>
        <p className="text-xs text-muted-foreground">
          No SDK, no auth. Standard HTTP GET endpoints that return JSON. Build dashboards, alerts, or feed data into your own agent.
        </p>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium">Market data</p>
        <LiveEndpoint url={`${BASE_URL}/api/market-data/mento`} label="GET /api/market-data/mento" />
        <LiveEndpoint url={`${BASE_URL}/api/market-data/forex`} label="GET /api/market-data/forex" />
        <LiveEndpoint url={`${BASE_URL}/api/market-data/crypto`} label="GET /api/market-data/crypto" />
      </div>

      <div className="space-y-3">
        <p className="text-xs font-medium">Agent data</p>
        <LiveEndpoint url={`${BASE_URL}/api/agent/track-record`} label="GET /api/agent/track-record" />
        <LiveEndpoint url={`${BASE_URL}/api/agent/policy`} label="GET /api/agent/policy" />
        <LiveEndpoint url={`${BASE_URL}/api/signals`} label="GET /api/signals" />
        <LiveEndpoint url={`${BASE_URL}/api/trades`} label="GET /api/trades" />
      </div>

      <div>
        <p className="text-xs font-medium mb-2">Example: build a spread alert bot</p>
        <CodeBlock
          lang="typescript"
          code={`// Fetch Mento rates, alert when spread > 0.5%
const res = await fetch("${BASE_URL}/api/market-data/mento");
const { pairs } = await res.json();

for (const pair of pairs) {
  if (Math.abs(pair.spreadPct) > 0.5) {
    console.log(\`Alert: \${pair.pair} spread \${pair.spreadPct}%\`);
    // Trigger your swap, notification, etc.
  }
}`}
        />
      </div>
    </div>
  );
}

function X402Tab() {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-medium mb-1">Micropayment-gated signals</h3>
        <p className="text-xs text-muted-foreground">
          Premium FX signals behind an x402 paywall. Pay $0.01 cUSD per unlock — no subscription, no account. Standard HTTP 402 flow.
        </p>
      </div>

      <div>
        <p className="text-xs font-medium mb-2">How x402 works</p>
        <div className="space-y-2">
          {[
            { step: "1", text: "Client sends GET /api/premium-signals" },
            { step: "2", text: "Server returns HTTP 402 with payment requirements (amount, token, recipient)" },
            { step: "3", text: "Client signs EIP-712 payment authorization" },
            { step: "4", text: "Client retries with X-PAYMENT header containing signed authorization" },
            { step: "5", text: "Server verifies payment, returns premium signal data" },
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
        <p className="text-xs font-medium mb-2">Test the paywall</p>
        <CodeBlock
          code={`# This will return HTTP 402 with payment requirements
curl -I ${BASE_URL}/api/premium-signals

# Response headers include:
# X-Payment-Required: true
# X-Payment-Amount: 10000 (0.01 cUSD, 6 decimals)
# X-Payment-Token: 0x765D...282a (cUSD on Celo)`}
        />
        <LiveEndpoint url={`${BASE_URL}/api/premium-signals`} label="GET /api/premium-signals — returns 402" />
      </div>

      <div>
        <p className="text-xs font-medium mb-2">Integration with Thirdweb x402</p>
        <CodeBlock
          lang="typescript"
          code={`import { createThirdwebClient } from "thirdweb";
import { payWith402 } from "thirdweb/extensions/x402";

const client = createThirdwebClient({ clientId: "..." });

// Automatically handles 402 → sign → retry flow
const signals = await payWith402({
  client,
  url: "${BASE_URL}/api/premium-signals",
  chain: celo,
});`}
        />
      </div>
    </div>
  );
}

export default function DevelopersPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("mcp");

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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`text-left rounded-lg border p-3 transition-colors ${
                activeTab === tab.key
                  ? "border-foreground bg-accent"
                  : "border-border hover:bg-accent/50"
              }`}
            >
              <tab.icon className={`size-4 mb-1.5 ${activeTab === tab.key ? "text-foreground" : "text-muted-foreground"}`} />
              <p className="text-sm font-medium">{tab.label}</p>
              <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{tab.desc}</p>
            </button>
          ))}
        </div>

        {/* Active tab content */}
        <Card>
          <CardContent className="p-5">
            {activeTab === "mcp" && <McpTab />}
            {activeTab === "a2a" && <A2aTab />}
            {activeTab === "rest" && <RestTab />}
            {activeTab === "x402" && <X402Tab />}
          </CardContent>
        </Card>

        {/* Quick reference */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <FileJson className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Quick Reference</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5">
              {[
                { label: "MCP Server", value: "/api/mcp", link: `${BASE_URL}/api/mcp` },
                { label: "A2A Agent Card", value: "/.well-known/agent-card.json", link: `${BASE_URL}/.well-known/agent-card.json` },
                { label: "Agent Policy", value: "/api/agent/policy", link: `${BASE_URL}/api/agent/policy` },
                { label: "Track Record", value: "/api/agent/track-record", link: `${BASE_URL}/api/agent/track-record` },
                { label: "TEE Attestation", value: "/api/tee/attestation", link: `${BASE_URL}/api/tee/attestation` },
                { label: "Health Check", value: "/api/health", link: `${BASE_URL}/api/health` },
                { label: "Premium Signals", value: "/api/premium-signals", link: `${BASE_URL}/api/premium-signals` },
                { label: "ERC-8004 Registration", value: "/.well-known/agent-registration.json", link: `${BASE_URL}/.well-known/agent-registration.json` },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-1 border-b border-border/30">
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                  <a
                    href={item.link}
                    target="_blank"
                    className="text-xs font-mono text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    {item.value} <ExternalLink className="size-2.5" />
                  </a>
                </div>
              ))}
            </div>
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
