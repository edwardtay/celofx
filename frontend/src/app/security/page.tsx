"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  Lock,
  FileCheck,
  Eye,
  Cpu,
  Coins,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Hash,
  ScrollText,
  Power,
  BarChart3,
} from "lucide-react";

const POLICY = {
  allowedTokens: ["cUSD", "cEUR", "cREAL"],
  allowedProtocol: "Mento Broker (0x777A...)",
  maxSwapPerTx: "100 cUSD",
  maxDailyVolume: "500 cUSD",
  minSpread: "0.3%",
  model: "Claude Sonnet 4.5",
};

const DECISION_CHECKS = [
  "Rate momentum (last 3 data points)",
  "Volatility (standard deviation)",
  "Urgency (time to deadline)",
  "Forex signal (trend correlation)",
  "Spread vs forex (Mento divergence)",
];

const NEVER_EXECUTE = [
  "Rate < target AND gap > 2% AND not urgent",
  "spreadVsForexPct < -1% (forex disagrees with Mento)",
];

export default function SecurityPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 px-6 py-6 max-w-4xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-2xl font-display tracking-tight">
            Security & Trust
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            How CeloFX minimizes trust — on-chain constraints, TEE attestation, and auditable decisions
          </p>
        </div>

        {/* Trust Model Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Shield, label: "ERC-8004", desc: "On-chain identity #10", color: "text-blue-600" },
            { icon: Cpu, label: "Intel TDX", desc: "TEE via Phala Cloud", color: "text-green-600" },
            { icon: Lock, label: "Permissioned", desc: "Token & protocol whitelist", color: "text-amber-600" },
            { icon: Eye, label: "Auditable", desc: "Every decision hashed", color: "text-purple-600" },
          ].map((item) => (
            <Card key={item.label}>
              <CardContent className="p-4 text-center">
                <item.icon className={`h-6 w-6 mx-auto mb-2 ${item.color}`} />
                <p className="font-medium text-sm">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Agent Policy (Standing Intent) */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <ScrollText className="h-5 w-5 text-blue-600" />
              <h2 className="font-semibold">Agent Policy (Standing Intent)</h2>
              <Badge variant="outline" className="ml-auto text-xs">keccak256 signed</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Cryptographically signed declaration of what the agent is authorized to do.
              The agent cannot exceed these bounds — any violation is detectable.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h3 className="text-sm font-medium flex items-center gap-1.5">
                  <Coins className="h-4 w-4" /> Spending Limits
                </h3>
                <div className="text-sm space-y-1 text-muted-foreground">
                  <p>Max per swap: <span className="text-foreground font-mono">{POLICY.maxSwapPerTx}</span></p>
                  <p>Daily volume cap: <span className="text-foreground font-mono">{POLICY.maxDailyVolume}</span></p>
                  <p>Min spread to execute: <span className="text-foreground font-mono">{POLICY.minSpread}</span></p>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-medium flex items-center gap-1.5">
                  <Lock className="h-4 w-4" /> Token & Protocol Whitelist
                </h3>
                <div className="text-sm space-y-1 text-muted-foreground">
                  <p>Allowed tokens: <span className="text-foreground font-mono">{POLICY.allowedTokens.join(", ")}</span></p>
                  <p>Allowed protocol: <span className="text-foreground font-mono">{POLICY.allowedProtocol}</span></p>
                  <p>AI model: <span className="text-foreground font-mono">{POLICY.model}</span></p>
                </div>
              </div>
            </div>
            <a
              href="/api/agent/policy"
              target="_blank"
              className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
            >
              View full policy JSON with hash <ExternalLink className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>

        {/* Policy Enforcement (NEW) */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-orange-600" />
              <h2 className="font-semibold">Policy Enforcement</h2>
              <Badge variant="outline" className="ml-auto text-xs">enforced in code</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Policy limits are not just declared — they are enforced at runtime.
              Every swap is checked against hard limits before execution.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="border rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Coins className="h-4 w-4 text-orange-500" />
                  <p className="text-sm font-medium">Volume Cap</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Rolling 24h window tracks all swaps. Rejects if total exceeds 500 cUSD.
                </p>
                <code className="text-[11px] text-muted-foreground font-mono block mt-1">
                  checkVolumeLimit(amount) → allowed/denied
                </code>
              </div>
              <div className="border rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Power className="h-4 w-4 text-red-500" />
                  <p className="text-sm font-medium">Circuit Breaker</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Emergency kill switch. Set AGENT_PAUSED=true to halt all execution instantly.
                </p>
                <code className="text-[11px] text-muted-foreground font-mono block mt-1">
                  isAgentPaused() → 503 Service Unavailable
                </code>
              </div>
              <div className="border rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Hash className="h-4 w-4 text-purple-500" />
                  <p className="text-sm font-medium">Decision Audit</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Every execution decision is hashed before the swap tx is sent. Publicly queryable.
                </p>
                <a href="/api/agent/decisions" target="_blank" className="text-[11px] text-blue-600 hover:underline inline-flex items-center gap-1 mt-1">
                  GET /api/agent/decisions <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Decision Framework */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-green-600" />
              <h2 className="font-semibold">Decision Framework</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Before every execution, Claude must evaluate all 5 conditions.
              Each decision is hashed with keccak256 and committed for auditability.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-green-600" /> Required Checks (all 5)
                </h3>
                <ul className="space-y-1">
                  {DECISION_CHECKS.map((check) => (
                    <li key={check} className="text-sm text-muted-foreground flex items-start gap-1.5">
                      <Hash className="h-3.5 w-3.5 mt-0.5 text-green-500 shrink-0" />
                      {check}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-red-500" /> Never Execute Conditions
                </h3>
                <ul className="space-y-1">
                  {NEVER_EXECUTE.map((rule) => (
                    <li key={rule} className="text-sm text-muted-foreground flex items-start gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 text-red-400 shrink-0" />
                      {rule}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* TEE Attestation */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-green-600" />
              <h2 className="font-semibold">TEE Attestation</h2>
              <Badge variant="outline" className="ml-auto text-xs">Intel TDX</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Agent runs in a Trusted Execution Environment on Phala Cloud.
              Intel TDX hardware ensures the private key never touches disk in plaintext.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { label: "Hardware", value: "Intel TDX" },
                { label: "Provider", value: "Phala Cloud CVM" },
                { label: "Attestation", value: "Hardware-signed quote" },
              ].map((item) => (
                <div key={item.label} className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-mono">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <a
                href="/api/tee/attestation"
                target="_blank"
                className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                View attestation <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href="https://cloud.phala.com/dashboard/cvms/app_0e73394e6e0afc0e4de5cb899d11edf4edeb3cd5"
                target="_blank"
                className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                Phala Cloud dashboard <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>

        {/* On-Chain Auditability */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-purple-600" />
              <h2 className="font-semibold">On-Chain Auditability</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Every agent action is verifiable on-chain. No hidden state — everything
              can be independently verified by anyone.
            </p>
            <div className="space-y-2">
              {[
                { label: "Agent Identity", value: "ERC-8004 #10", link: "https://8004scan.io/agents/celo/10" },
                { label: "Agent Wallet", value: "0x6652...a303", link: "https://celoscan.io/address/0x6652AcDc623b7CCd52E115161d84b949bAf3a303" },
                { label: "Reputation", value: "24 on-chain reviews", link: "https://8004scan.io/agents/celo/10?tab=feedback" },
                { label: "Swap Txs", value: "All on Celoscan", link: "https://celoscan.io/address/0x6652AcDc623b7CCd52E115161d84b949bAf3a303" },
                { label: "Decision Log", value: "Hashed & publicly queryable", link: "/api/agent/decisions" },
                { label: "Metadata", value: "Immutable data URI on-chain", link: "https://8004scan.io/agents/celo/10?tab=metadata" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <a
                    href={item.link}
                    target="_blank"
                    className="text-sm font-mono text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    {item.value} <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
