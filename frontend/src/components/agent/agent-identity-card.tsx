"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAgentTokenURI, useAgentOwner, useAgentId } from "@/hooks/use-agent-profile";
import { formatAddress } from "@/lib/format";
import { ExternalLink, Activity } from "lucide-react";
import Image from "next/image";
import { IDENTITY_REGISTRY_ADDRESS } from "@/config/contracts";
import { useEffect, useState } from "react";
import { useSignals } from "@/hooks/use-signals";

interface AgentMetadata {
  name: string;
  description: string;
  image?: string;
}

export function AgentIdentityCard() {
  const agentId = useAgentId();
  const { data: tokenURI, isLoading: uriLoading } = useAgentTokenURI();
  const { data: owner, isLoading: ownerLoading } = useAgentOwner();
  const [metadata, setMetadata] = useState<AgentMetadata | null>(null);
  const { data: signals } = useSignals();

  useEffect(() => {
    if (!tokenURI) return;
    const uri = tokenURI as string;

    // Handle data URIs and HTTP URIs
    if (uri.startsWith("data:")) {
      try {
        const json = atob(uri.split(",")[1]);
        setMetadata(JSON.parse(json));
      } catch {
        setMetadata({ name: "CeloFX", description: "Autonomous FX Agent" });
      }
    } else if (uri.startsWith("http")) {
      fetch(uri)
        .then((r) => r.json())
        .then(setMetadata)
        .catch(() =>
          setMetadata({ name: "CeloFX", description: "Autonomous FX Agent" })
        );
    }
  }, [tokenURI]);

  const isLoading = uriLoading || ownerLoading;

  // Use "CeloFX" as display name (on-chain metadata may have registration name)
  const displayName = "CeloFX";
  const displayDesc =
    "Autonomous FX agent. Analyzes forex markets and executes stablecoin swaps via Mento on Celo. Registered via ERC-8004.";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/agent-avatar.png"
              alt="CeloFX Agent"
              width={40}
              height={40}
              className="size-10 rounded-full object-cover"
            />
            <div>
              <CardTitle className="text-lg font-display">
                {displayName}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                FX Arbitrage Agent · ERC-8004 #{agentId.toString()}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="gap-1">
            <div className="size-1.5 rounded-full bg-emerald-500" />
            Active
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          {displayDesc}
        </p>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Owner</p>
            {isLoading ? (
              <div className="h-5 w-24 bg-muted rounded animate-pulse" />
            ) : (
              <p className="font-mono text-xs">
                {owner ? formatAddress(owner as string) : "Not registered"}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Registry</p>
            <p className="font-mono text-xs">ERC-8004 Identity</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Chain</p>
            <p className="text-xs">Celo</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Markets</p>
            <p className="text-xs">Forex, Mento Stablecoins</p>
          </div>
        </div>

        {signals && signals.length > 0 && (
          <div className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Activity className="size-3" />
              Signal Activity
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {(["mento", "forex", "crypto", "commodities"] as const).map((m) => {
                const count = signals.filter((s) => s.market === m).length;
                return (
                  <div key={m}>
                    <p className="text-sm font-semibold font-mono">{count}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{m}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <a
            href={`https://celoscan.io/address/${IDENTITY_REGISTRY_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Identity Registry
            <ExternalLink className="size-3" />
          </a>
          <a
            href="https://celoscan.io/tx/0xea64b5d790028208b285bb05a00cb506b44f7fa6d10099cff6671bd42e9a3ab6"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Registration Tx
            <ExternalLink className="size-3" />
          </a>
          <a
            href={`https://celoscan.io/nft/${IDENTITY_REGISTRY_ADDRESS}/${agentId.toString()}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            NFT #{agentId.toString()}
            <ExternalLink className="size-3" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}
