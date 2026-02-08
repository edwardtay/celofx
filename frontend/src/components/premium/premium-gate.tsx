"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock, Unlock, Loader2, AlertCircle } from "lucide-react";
import { useWalletClient } from "wagmi";
import type { Signal } from "@/lib/types";

export function PremiumGate({
  children,
}: {
  children: (signals: Signal[]) => React.ReactNode;
}) {
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const { data: walletClient } = useWalletClient();

  const handleUnlock = async () => {
    setLoading(true);
    setError(null);

    try {
      if (walletClient) {
        // Real x402 flow: use @x402/fetch to handle 402 → sign → retry
        const { wrapFetchWithPayment, x402Client } = await import("@x402/fetch");
        const { ExactEvmScheme } = await import("@x402/evm/exact/client");

        // Adapt wagmi walletClient to ClientEvmSigner interface
        const signer = {
          address: walletClient.account.address,
          signTypedData: (msg: {
            domain: Record<string, unknown>;
            types: Record<string, unknown>;
            primaryType: string;
            message: Record<string, unknown>;
          }) =>
            walletClient.signTypedData({
              account: walletClient.account,
              domain: msg.domain as Record<string, unknown>,
              types: msg.types as Record<string, unknown>,
              primaryType: msg.primaryType,
              message: msg.message as Record<string, unknown>,
            }),
        } as const;

        const client = new x402Client()
          .register("eip155:42220", new ExactEvmScheme(signer));

        const fetchWithPay = wrapFetchWithPayment(fetch, client);
        const res = await fetchWithPay("/api/premium-signals");

        if (res.ok) {
          const data = await res.json();
          setSignals(data);
          setUnlocked(true);
          return;
        }
        setError("Payment failed. Please try again.");
      } else {
        setError("Connect your wallet to unlock premium signals.");
      }
    } catch (err) {
      console.error("x402 payment error:", err);
      // Fallback: direct fetch for demo (when facilitator unavailable)
      try {
        const res = await fetch("/api/premium-signals");
        if (res.status === 402) {
          setError("Connect wallet on Celo to pay with x402.");
        }
      } catch {
        setError("Payment service unavailable.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (unlocked) {
    return <>{children(signals)}</>;
  }

  return (
    <Card className="border-dashed">
      <CardContent className="py-12 flex flex-col items-center gap-4 text-center">
        <div className="flex items-center justify-center size-12 rounded-full bg-muted">
          <Lock className="size-5 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-semibold mb-1">Premium Signals</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Get detailed analysis with entry/exit prices, stop losses, and
            in-depth reasoning. Powered by x402 micropayments.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono font-semibold">$0.01</span>
          <span className="text-muted-foreground">per access in USDC on Celo</span>
        </div>
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="size-4" />
            {error}
          </div>
        )}
        <Button onClick={handleUnlock} disabled={loading || !walletClient} className="gap-1.5">
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Processing Payment...
            </>
          ) : (
            <>
              <Unlock className="size-4" />
              Unlock Premium
            </>
          )}
        </Button>
        {!walletClient && (
          <p className="text-xs text-amber-600">
            Connect your wallet on Celo to unlock
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Payment settled on-chain via x402 protocol (HTTP 402)
        </p>
      </CardContent>
    </Card>
  );
}
