"use client";

import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import {
  Shield,
  Lock,
  Eye,
  Cpu,
  ExternalLink,
  Database,
} from "lucide-react";

const DECISION_REGISTRY = "0xF8faC012318671b6694732939bcB6EA8d2c91662";

export default function SecurityPage() {
  const [teeVerified, setTeeVerified] = useState(false);
  const [onChainCount, setOnChainCount] = useState(0);
  const [attestationAnchored, setAttestationAnchored] = useState(false);
  const [attestationTxHash, setAttestationTxHash] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/attestation")
      .then((r) => r.json())
      .then((d) => {
        setTeeVerified(d?.tee?.verified === true);
        setAttestationAnchored(d?.onChainAnchor?.anchored === true);
        setAttestationTxHash(d?.onChainAnchor?.txHash || null);
      })
      .catch(() => setTeeVerified(false));
    fetch("/api/agent/decisions")
      .then((r) => r.json())
      .then((d) => setOnChainCount(d?.onChain?.totalOnChainDecisions ?? 0))
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 px-6 py-6 max-w-4xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-2xl font-display tracking-tight">
            Security & Trust
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            How CeloFX minimizes trust — on-chain constraints, verifiable execution, and auditable decisions
          </p>
        </div>

        {/* Trust Model Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: Shield, label: "ERC-8004", desc: "On-chain identity #10", color: "text-blue-600" },
            { icon: Cpu, label: teeVerified ? "TEE Active" : "TEE Ready", desc: teeVerified ? "Intel TDX verified" : "Phala CVM ready", color: teeVerified ? "text-green-600" : "text-amber-600" },
            { icon: Lock, label: "Permissioned", desc: "Token & protocol whitelist", color: "text-amber-600" },
            { icon: Eye, label: "Auditable", desc: "Every decision on-chain", color: "text-purple-600" },
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

        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-blue-600" />
              <h2 className="font-semibold">Operational Controls</h2>
              <Badge variant="outline" className="ml-auto text-xs">public summary</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              CeloFX runs with bounded permissions, automated risk controls, and externally verifiable outputs.
              Sensitive implementation details are intentionally kept private.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="border rounded-lg p-3">
                <p className="text-sm font-medium">Bounded Execution</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Execution is constrained to approved assets and policy-checked actions.
                </p>
              </div>
              <div className="border rounded-lg p-3">
                <p className="text-sm font-medium">Runtime Safeguards</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Automated safeguards and pause controls protect against abnormal conditions.
                </p>
              </div>
              <div className="border rounded-lg p-3">
                <p className="text-sm font-medium">Audit Trail</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Execution outcomes and identity records are independently auditable on-chain.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* On-Chain Decision Registry */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-emerald-600" />
              <h2 className="font-semibold">On-Chain Decision Registry</h2>
              <Badge variant="outline" className="ml-auto text-xs border-emerald-500 text-emerald-700">
                live on Celo
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Every agent decision is committed on-chain as an event on the Decision Registry contract.
              Anyone can independently verify the full decision history via Celoscan.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Contract</p>
                <a
                  href={`https://celoscan.io/address/${DECISION_REGISTRY}#events`}
                  target="_blank"
                  className="text-sm font-mono text-blue-600 hover:underline inline-flex items-center gap-1"
                >
                  {DECISION_REGISTRY.slice(0, 6)}...{DECISION_REGISTRY.slice(-4)} <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">On-Chain Decisions</p>
                <p className="text-sm font-mono">{onChainCount}</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">Attestation Anchor</p>
                {attestationAnchored ? (
                  <a
                    href={attestationTxHash ? `https://celoscan.io/tx/${attestationTxHash}` : "#"}
                    target="_blank"
                    className="text-sm font-mono text-blue-600 hover:underline inline-flex items-center gap-1"
                  >
                    Anchored <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <p className="text-sm font-mono text-muted-foreground">Pending</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* TEE Attestation */}
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-green-600" />
              <h2 className="font-semibold">Verifiable Execution (TEE)</h2>
              <Badge variant="outline" className={`ml-auto text-xs ${teeVerified ? "border-green-500 text-green-700" : ""}`}>
                {teeVerified ? "Verified" : "TEE-Ready"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {teeVerified
                ? "Agent runs in a Trusted Execution Environment (Intel TDX via Phala Cloud). Private key is hardware-isolated and execution is cryptographically attested."
                : "Agent is TEE-ready with Intel TDX support via Phala Cloud. When deployed to a Confidential VM, the private key is hardware-isolated and execution is cryptographically attested."}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { label: "Hardware", value: "Intel TDX" },
                { label: "Provider", value: teeVerified ? "Phala Cloud CVM (Active)" : "Phala Cloud CVM (Ready)" },
                { label: "Audit", value: "On-chain anchored" },
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
                href="/api/agent/decisions"
                target="_blank"
                className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                Decision audit log <ExternalLink className="h-3 w-3" />
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
                { label: "Reputation", value: "On-chain reviews", link: "https://8004scan.io/agents/celo/10?tab=feedback" },
                { label: "Swap Txs", value: "All on Celoscan", link: "https://celoscan.io/address/0x6652AcDc623b7CCd52E115161d84b949bAf3a303" },
                { label: "Decision Registry", value: `${DECISION_REGISTRY.slice(0, 6)}...${DECISION_REGISTRY.slice(-4)}`, link: `https://celoscan.io/address/${DECISION_REGISTRY}#events` },
                { label: "Decision Log", value: "API + on-chain events", link: "/api/agent/decisions" },
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
