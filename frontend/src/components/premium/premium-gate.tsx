"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Lock,
  Unlock,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Server,
  Wallet,
  Eye,
  Code2,
} from "lucide-react";
import { useWalletClient } from "wagmi";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Signal } from "@/lib/types";

type PaymentStep = "idle" | "requesting" | "signing" | "verifying" | "done";

const stepLabels: Record<PaymentStep, string> = {
  idle: "",
  requesting: "Server returning HTTP 402...",
  signing: "Wallet signing EIP-712 payment...",
  verifying: "Verifying payment on Celo...",
  done: "Access granted!",
};

export function PremiumGate({
  children,
}: {
  children: (signals: Signal[]) => React.ReactNode;
}) {
  const [unlocked, setUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [step, setStep] = useState<PaymentStep>("idle");
  const [liveProof, setLiveProof] = useState<{
    status: number;
    header: string;
  } | null>(null);
  const { data: walletClient } = useWalletClient();
  const searchParams = useSearchParams();
  const isDemo = searchParams.get("demo") === "true";

  const handleDemoUnlock = async () => {
    setLoading(true);
    setLiveProof(null);

    // Step 1: Actually hit the premium API to get a REAL 402
    setStep("requesting");
    try {
      const real402 = await fetch("/api/premium-signals");
      const paymentHeader =
        real402.headers.get("x-payment-required") || "";
      setLiveProof({ status: real402.status, header: paymentHeader });
    } catch {
      // API might be cold-starting — continue demo anyway
    }
    await new Promise((r) => setTimeout(r, 600));

    // Step 2: Simulate wallet signing
    setStep("signing");
    await new Promise((r) => setTimeout(r, 1000));

    // Step 3: Simulate verification
    setStep("verifying");
    await new Promise((r) => setTimeout(r, 600));
    setStep("done");

    // Fetch signals directly (bypass 402 for demo)
    try {
      const res = await fetch("/api/signals");
      if (res.ok) {
        const data = await res.json();
        const premium = data.filter((s: Signal) => s.tier === "premium");
        setSignals(premium.length > 0 ? premium : data.slice(0, 4));
      }
    } catch {
      // Use empty array — children will handle empty state
    }

    await new Promise((r) => setTimeout(r, 500));
    setUnlocked(true);
    setLoading(false);
  };

  const handleUnlock = async () => {
    if (isDemo) {
      return handleDemoUnlock();
    }

    setLoading(true);
    setError(null);
    setStep("requesting");

    try {
      if (walletClient) {
        const { wrapFetchWithPayment, x402Client } = await import("@x402/fetch");
        const { ExactEvmScheme } = await import("@x402/evm/exact/client");

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

        setStep("signing");
        const fetchWithPay = wrapFetchWithPayment(fetch, client);
        const res = await fetchWithPay("/api/premium-signals");

        setStep("verifying");

        if (res.ok) {
          const data = await res.json();
          setSignals(data);
          setStep("done");
          await new Promise((r) => setTimeout(r, 500));
          setUnlocked(true);
          return;
        }
        setError("Payment failed. Please try again.");
      } else {
        setError("Connect your wallet to unlock premium signals.");
      }
    } catch (err) {
      console.error("x402 payment error:", err);
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
      if (step !== "done") setStep("idle");
    }
  };

  if (unlocked) {
    return <>{children(signals)}</>;
  }

  const previews = [
    { market: "crypto", asset: "CELO/USD", direction: "Long", confidence: 71 },
    { market: "stocks", asset: "TSLA", direction: "Short", confidence: 68 },
    { market: "forex", asset: "GBP/USD", direction: "Short", confidence: 63 },
    { market: "commodities", asset: "Silver (XAG)", direction: "Long", confidence: 76 },
  ];

  return (
    <div className="space-y-4">
      {isDemo && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg px-4 py-2.5 flex items-center gap-2 text-sm text-amber-800">
          <Eye className="size-4 shrink-0" />
          Demo mode — payment simulation only. Real payments use x402 on Celo.
        </div>
      )}

      <div className="relative">
        <div className="space-y-3 blur-[4px] select-none pointer-events-none" aria-hidden>
          {previews.map((p) => (
            <div key={p.asset} className="border rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium px-2 py-0.5 rounded border bg-muted">{p.market}</span>
                  <span className="font-semibold">{p.asset}</span>
                </div>
                <span className="text-xs font-mono">{p.direction} · {p.confidence}%</span>
              </div>
              <div className="h-3 bg-muted rounded w-full" />
              <div className="h-3 bg-muted rounded w-3/4" />
              <div className="flex gap-4 text-xs font-mono pt-1">
                <span>Entry $---.--</span>
                <span className="text-emerald-600">TP $---.--</span>
                <span className="text-red-600">SL $---.--</span>
              </div>
            </div>
          ))}
        </div>

        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-xl">
          <div className="flex flex-col items-center gap-4 text-center max-w-sm">
            <div className="flex items-center justify-center size-12 rounded-full bg-muted">
              <Lock className="size-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Unlock {previews.length} Premium Signals</h3>
              <p className="text-sm text-muted-foreground">
                Entry/exit prices, stop losses, and detailed reasoning
              </p>
            </div>

            {/* Payment flow steps */}
            {loading && (
              <div className="w-full max-w-xs space-y-2">
                <PaymentStepRow
                  icon={<Server className="size-3.5" />}
                  label={
                    liveProof
                      ? `Server returned HTTP ${liveProof.status}`
                      : "Server returns HTTP 402"
                  }
                  active={step === "requesting"}
                  done={["signing", "verifying", "done"].includes(step)}
                />
                <PaymentStepRow
                  icon={<Wallet className="size-3.5" />}
                  label="Wallet signs EIP-712"
                  active={step === "signing"}
                  done={["verifying", "done"].includes(step)}
                />
                <PaymentStepRow
                  icon={<CheckCircle2 className="size-3.5" />}
                  label="Payment verified on Celo"
                  active={step === "verifying"}
                  done={step === "done"}
                />
                {/* Live 402 proof — show actual response header */}
                {liveProof && ["signing", "verifying", "done"].includes(step) && (
                  <div className="mt-1 bg-muted/50 border rounded p-2 text-left">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                      <Code2 className="size-2.5" />
                      Live API response
                    </div>
                    <p className="text-[10px] font-mono text-emerald-600">
                      HTTP {liveProof.status} Payment Required
                    </p>
                    {liveProof.header && (
                      <p className="text-[10px] font-mono text-muted-foreground truncate">
                        X-PAYMENT-REQUIRED: {liveProof.header.slice(0, 60)}...
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {!loading && (
              <div className="flex items-center gap-2 text-sm">
                <span className="font-mono font-semibold">$0.01</span>
                <span className="text-muted-foreground">in cUSD on Celo</span>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="size-4" />
                {error}
              </div>
            )}

            <Button
              onClick={handleUnlock}
              disabled={loading || (!walletClient && !isDemo)}
              className="gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {stepLabels[step]}
                </>
              ) : (
                <>
                  <Unlock className="size-4" />
                  {isDemo ? "Unlock (Demo)" : "Unlock Premium"}
                </>
              )}
            </Button>

            {!walletClient && !isDemo && (
              <div className="text-center space-y-1">
                <p className="text-xs text-amber-600">
                  Connect your wallet on Celo to unlock
                </p>
                <Link
                  href="/premium?demo=true"
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                >
                  <Eye className="size-3" />
                  Or try the demo
                </Link>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              x402 protocol · HTTP 402 · EIP-712 signature
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentStepRow({
  icon,
  label,
  active,
  done,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div
        className={`flex items-center justify-center size-6 rounded-full transition-colors ${
          done
            ? "bg-emerald-100 text-emerald-600"
            : active
              ? "bg-foreground text-background"
              : "bg-muted text-muted-foreground"
        }`}
      >
        {done ? <CheckCircle2 className="size-3.5" /> : icon}
      </div>
      <span
        className={`transition-colors ${
          done
            ? "text-emerald-600 line-through"
            : active
              ? "text-foreground font-medium"
              : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
      {active && <Loader2 className="size-3 animate-spin text-muted-foreground ml-auto" />}
      {done && <CheckCircle2 className="size-3 text-emerald-500 ml-auto" />}
    </div>
  );
}
