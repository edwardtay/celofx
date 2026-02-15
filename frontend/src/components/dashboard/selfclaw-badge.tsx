"use client";

import { useEffect, useState } from "react";
import { Fingerprint, ExternalLink, CheckCircle2, Loader2 } from "lucide-react";

interface SelfClawData {
  verified: boolean;
  agentName?: string;
  humanId?: string;
  canonical?: {
    agentId?: number;
    wallet?: string;
    chainId?: number;
    registryUrl?: string;
  };
  deprecation?: {
    deprecatedAgentIds?: number[];
    message?: string;
  };
  metadata?: {
    nationality?: string;
    verificationMethod?: string;
  };
  selfxyz?: {
    registeredAt?: string;
  };
}

export function SelfClawBadge({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<SelfClawData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/selfclaw")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData({ verified: false }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        <span>Checking SelfClaw...</span>
      </div>
    );
  }

  if (!data?.verified) return null;
  const verifyUrl = data.canonical?.registryUrl || "https://www.8004scan.io/agents/celo/10";

  if (compact) {
    return (
      <a
        href={verifyUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 border rounded-full px-3 py-1.5 text-xs hover:bg-accent/50 transition-colors"
      >
        <Fingerprint className="size-3.5 text-blue-600" />
        <span className="text-muted-foreground">Human-Backed</span>
        <CheckCircle2 className="size-3 text-emerald-500" />
      </a>
    );
  }

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Fingerprint className="size-4 text-blue-600" />
          <h3 className="text-sm font-medium">SelfClaw Verified</h3>
          <span className="inline-flex items-center gap-1 text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">
            <CheckCircle2 className="size-2.5" />
            Human-Backed
          </span>
        </div>
        <a
          href={verifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
        >
          Verify <ExternalLink className="size-3" />
        </a>
      </div>
      <p className="text-xs text-muted-foreground">
        This agent&apos;s cryptographic key is bound to a real human via passport-based ZK proof.
        No personal data is exposed — only proof that a verified human controls this agent.
      </p>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {data.metadata?.verificationMethod && (
          <span>Method: <span className="font-mono font-medium text-foreground">{data.metadata.verificationMethod}</span></span>
        )}
        {data.selfxyz?.registeredAt && (
          <span>Registered: <span className="font-mono font-medium text-foreground">{new Date(data.selfxyz.registeredAt).toLocaleDateString()}</span></span>
        )}
        {data.metadata?.nationality && (
          <span>Nationality: <span className="font-mono font-medium text-foreground">{data.metadata.nationality}</span></span>
        )}
      </div>
      {data.deprecation?.deprecatedAgentIds?.length ? (
        <p className="text-[11px] text-muted-foreground">
          Canonical profile: #{data.canonical?.agentId ?? 10}. Deprecated duplicate(s): {data.deprecation.deprecatedAgentIds.join(", ")}.
        </p>
      ) : null}
    </div>
  );
}
