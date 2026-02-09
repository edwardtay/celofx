"use client";

import { useState, useEffect } from "react";
import { useAgentTokenURI, useAgentId } from "@/hooks/use-agent-profile";
import {
  Code2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ExternalLink,
  Loader2,
  LinkIcon,
} from "lucide-react";
import { IDENTITY_REGISTRY_ADDRESS } from "@/config/contracts";

export function OnChainMetadata() {
  const agentId = useAgentId();
  const { data: tokenURI, isLoading } = useAgentTokenURI();
  const [expanded, setExpanded] = useState(false);
  const [metadata, setMetadata] = useState<Record<string, unknown> | null>(
    null
  );
  const [metadataSource, setMetadataSource] = useState<string | null>(null);

  // Parse metadata when tokenURI loads
  useEffect(() => {
    if (!tokenURI || metadata || isLoading) return;
    const uri = tokenURI as string;
    if (uri.startsWith("data:")) {
      try {
        const json = atob(uri.split(",")[1]);
        setMetadata(JSON.parse(json));
        setMetadataSource("data URI (base64 encoded on-chain)");
      } catch {
        setMetadataSource("data URI (failed to parse)");
      }
    } else if (uri.startsWith("http")) {
      setMetadataSource(uri);
      fetch(uri)
        .then((r) => r.json())
        .then((data) => setMetadata(data))
        .catch(() => setMetadataSource("HTTP URI (failed to fetch)"));
    }
  }, [tokenURI, metadata, isLoading]);

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LinkIcon className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">On-Chain Metadata</h3>
        </div>
        {isLoading ? (
          <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
        ) : tokenURI ? (
          <div className="flex items-center gap-1 text-[10px] text-emerald-600">
            <CheckCircle2 className="size-3" />
            Verified on-chain
          </div>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">
        This data is fetched live from the ERC-8004 Identity Registry on Celo
        via <code className="text-[10px] bg-muted px-1 rounded">tokenURI({agentId.toString()})</code>.
        It cannot be faked or modified without the owner&apos;s private key.
      </p>

      {metadata && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-muted-foreground">name</span>
            <p className="font-mono font-medium">CeloFX</p>
          </div>
          <div>
            <span className="text-muted-foreground">x402Support</span>
            <p className="font-mono font-medium">
              {metadata.x402Support ? "true" : "false"}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">active</span>
            <p className="font-mono font-medium">
              {metadata.active ? "true" : "false"}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">trust</span>
            <p className="font-mono font-medium">
              {Array.isArray(metadata.supportedTrust)
                ? (metadata.supportedTrust as string[]).join(", ")
                : "reputation"}
            </p>
          </div>
        </div>
      )}

      {metadataSource && (
        <div className="text-[10px] text-muted-foreground">
          Source: <span className="font-mono">{metadataSource}</span>
        </div>
      )}

      {/* Expandable raw JSON */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Code2 className="size-3" />
        {expanded ? "Hide" : "View"} raw metadata JSON
        {expanded ? (
          <ChevronUp className="size-3" />
        ) : (
          <ChevronDown className="size-3" />
        )}
      </button>

      {expanded && metadata && (
        <div className="bg-muted/50 border rounded-lg p-3 overflow-x-auto">
          <pre className="text-[11px] font-mono text-muted-foreground leading-relaxed whitespace-pre">
            {JSON.stringify(metadata, null, 2)}
          </pre>
        </div>
      )}

      <div className="flex flex-wrap gap-3 pt-1">
        <a
          href={`https://celoscan.io/nft/${IDENTITY_REGISTRY_ADDRESS}/${agentId.toString()}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          View on Celoscan <ExternalLink className="size-2.5" />
        </a>
        <a
          href={`https://celoscan.io/address/${IDENTITY_REGISTRY_ADDRESS}#readContract`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Read contract <ExternalLink className="size-2.5" />
        </a>
      </div>
    </div>
  );
}
