"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Database,
  TrendingUp,
  TrendingDown,
  Globe,
} from "lucide-react";

interface ProtocolData {
  mento: {
    tvl: number;
    category: string;
    chains: string[];
    tvlChange7d: number;
  };
  celo: {
    tvl: number;
    name: string;
  };
  mentoShareOfCelo: number;
}

function formatTvl(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export function ProtocolHealth() {
  const [data, setData] = useState<ProtocolData | null>(null);

  useEffect(() => {
    fetch("/api/protocol-health")
      .then((r) => r.json())
      .then((d) => {
        if (d.mento) setData(d);
      })
      .catch(() => {});
  }, []);

  if (!data) return null;

  const trending = data.mento.tvlChange7d >= 0;

  return (
    <Card className="gap-0 py-0">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Protocol Health</span>
            <Badge
              variant="outline"
              className="text-[10px] bg-blue-50 text-blue-700 border-blue-200"
            >
              DeFiLlama
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">Source: DeFiLlama API</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="border rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider">
              <Database className="size-2.5" />
              Mento TVL
            </div>
            <p className="text-xl font-mono font-bold">
              {formatTvl(data.mento.tvl)}
            </p>
            <div className="flex items-center gap-1">
              {trending ? (
                <TrendingUp className="size-3 text-emerald-500" />
              ) : (
                <TrendingDown className="size-3 text-red-500" />
              )}
              <span
                className={`text-[10px] font-mono ${
                  trending ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {trending ? "+" : ""}
                {data.mento.tvlChange7d}% 7d
              </span>
            </div>
          </div>

          <div className="border rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider">
              <Globe className="size-2.5" />
              Celo TVL
            </div>
            <p className="text-xl font-mono font-bold">
              {formatTvl(data.celo.tvl)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Mento is {data.mentoShareOfCelo}%
            </p>
          </div>

          <div className="border rounded-lg p-3 space-y-1">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Category
            </div>
            <p className="text-sm font-medium">{data.mento.category}</p>
            <p className="text-[10px] text-muted-foreground">
              On-chain stablecoin protocol
            </p>
          </div>

          <div className="border rounded-lg p-3 space-y-1">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Chains
            </div>
            <p className="text-sm font-medium">{data.mento.chains.length}</p>
            <p className="text-[10px] text-muted-foreground truncate">
              {data.mento.chains.join(", ")}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
