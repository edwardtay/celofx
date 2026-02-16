"use client";

import { useCallback, useEffect, useState } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  useAccount,
  useReadContract,
  useSignMessage,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { erc20Abi, formatUnits, parseUnits } from "viem";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Vault,
  TrendingUp,
  Users,
  Coins,
  ChevronDown,
} from "lucide-react";
import type { VaultDeposit, VaultMetrics, PortfolioCompositionView } from "@/lib/types";
import { formatTimeAgo } from "@/lib/format";

const AGENT_ADDRESS = "0x6652AcDc623b7CCd52E115161d84b949bAf3a303";
const CUSD_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a";

interface VaultData {
  metrics: VaultMetrics;
  deposits: VaultDeposit[];
  position: {
    totalShares: number;
    currentValue: number;
    totalDeposited: number;
    pnl: number;
    deposits: VaultDeposit[];
  } | null;
}

export default function HedgePage() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [data, setData] = useState<VaultData | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioCompositionView | null>(null);
  const [depositAmount, setDepositAmount] = useState("100");
  const [step, setStep] = useState<"idle" | "confirm" | "transferring" | "recording" | "done">("idle");
  const [lastTransferAmount, setLastTransferAmount] = useState<string | null>(null);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const { data: rawBalance } = useReadContract({
    address: CUSD_ADDRESS as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const cusdBalance = rawBalance ? parseFloat(formatUnits(rawBalance, 18)) : 0;

  const {
    writeContract: writeTransfer,
    data: transferHash,
    reset: resetTransfer,
    error: transferError,
  } = useWriteContract();

  const { isSuccess: transferConfirmed } = useWaitForTransactionReceipt({ hash: transferHash });

  const fetchData = useCallback(async () => {
    const url = address ? `/api/vault?address=${address}` : "/api/vault";
    const [vaultRes, portfolioRes] = await Promise.all([
      fetch(url),
      fetch("/api/vault/portfolio").catch(() => null),
    ]);
    const vaultJson = await vaultRes.json();
    setData(vaultJson);
    if (portfolioRes?.ok) {
      const p = await portfolioRes.json();
      setPortfolio(p);
    }
  }, [address]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const recordDeposit = useCallback(
    async (txHash: string, amountText: string) => {
      if (!address) throw new Error("Wallet not connected");
      const timestamp = Date.now();
      const nonce = crypto.randomUUID();
      const normalizedAmount = amountText.trim();
      const message = [
        "CeloFX Vault Deposit",
        `depositor:${address.toLowerCase()}`,
        `amount:${normalizedAmount}`,
        `txHash:${txHash}`,
        `nonce:${nonce}`,
        `timestamp:${timestamp}`,
      ].join("\n");
      const signature = await signMessageAsync({ message });

      const res = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deposit",
          depositor: address,
          amount: normalizedAmount,
          txHash,
          signature,
          nonce,
          timestamp,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Recording failed" }));
        throw new Error(err.error || "Recording failed");
      }
    },
    [address, signMessageAsync]
  );

  useEffect(() => {
    if (transferConfirmed && step === "transferring" && address && transferHash) {
      setStep("recording");
      setDepositError(null);
      const amountText = depositAmount.trim();
      setLastTransferAmount(amountText);
      recordDeposit(transferHash, amountText)
        .then(() => {
          setStep("done");
          setDepositAmount("100");
          fetchData();
          setTimeout(() => {
            setStep("idle");
            resetTransfer();
          }, 2500);
        })
        .catch((err) => {
          setDepositError(err instanceof Error ? err.message : "Deposit recording failed");
          setStep("idle");
        });
    }
  }, [transferConfirmed, step, address, transferHash, depositAmount, fetchData, resetTransfer, recordDeposit]);

  useEffect(() => {
    if (transferError) {
      const message = transferError.message || "Transfer failed";
      setDepositError(message.includes("User rejected") ? "Transaction cancelled in wallet." : message);
      setStep("idle");
    }
  }, [transferError]);

  const handleDepositClick = () => {
    const amount = parseFloat(depositAmount);
    if (!depositAmount || !Number.isFinite(amount) || amount <= 0) {
      setDepositError("Enter a valid cUSD amount.");
      return;
    }
    if (amount > cusdBalance) {
      setDepositError("Amount exceeds your cUSD balance.");
      return;
    }
    setDepositError(null);
    setStep("confirm");
  };

  const handleConfirm = () => {
    setStep("transferring");
    const amount = parseUnits(depositAmount, 18);
    writeTransfer({
      address: CUSD_ADDRESS as `0x${string}`,
      abi: erc20Abi,
      functionName: "transfer",
      args: [AGENT_ADDRESS as `0x${string}`, amount],
    });
  };

  const handleWithdraw = async (depositId: string) => {
    if (!address) return;
    setWithdrawingId(depositId);
    setWithdrawError(null);
    try {
      const timestamp = Date.now();
      const nonce = crypto.randomUUID();
      const message = [
        "CeloFX Vault Withdraw",
        `depositor:${address.toLowerCase()}`,
        `depositId:${depositId}`,
        `nonce:${nonce}`,
        `timestamp:${timestamp}`,
      ].join("\n");
      const signature = await signMessageAsync({ message });

      const res = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "withdraw", depositId, depositor: address, signature, nonce, timestamp }),
      });
      const json = await res.json();
      if (!res.ok) {
        setWithdrawError(json.error || "Withdrawal failed");
        return;
      }
      await fetchData();
    } catch {
      setWithdrawError("Withdrawal failed. Please try again.");
    } finally {
      setWithdrawingId(null);
    }
  };

  const metrics = data?.metrics;
  const position = data?.position;
  const pending = step === "transferring" || step === "recording";

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-5 sm:px-6">
        <div>
          <h1 className="text-2xl font-display tracking-tight">Hedge</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Deposit cUSD. The agent maintains a hedged stablecoin allocation.
          </p>
        </div>

        {metrics && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-lg border p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1"><Coins className="size-2.5" />TVL</div>
              <p className="text-lg font-mono font-bold">${metrics.tvl.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1"><TrendingUp className="size-2.5" />Share</div>
              <p className="text-lg font-mono font-bold">${metrics.sharePrice.toFixed(4)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1"><Vault className="size-2.5" />APY</div>
              <p className="text-lg font-mono font-bold text-emerald-600">{metrics.apyEstimate.toFixed(1)}%</p>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1"><Users className="size-2.5" />Users</div>
              <p className="text-lg font-mono font-bold">{metrics.depositors}</p>
            </div>
          </div>
        )}

        <Card className="gap-0 py-0">
          <CardContent className="space-y-3 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Deposit cUSD</span>
              {isConnected && <span className="text-xs text-muted-foreground">Balance: {cusdBalance.toFixed(2)} cUSD</span>}
            </div>

            {!isConnected ? (
              <p className="text-sm text-muted-foreground">Connect wallet to deposit.</p>
            ) : (
              <>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                />

                {step === "confirm" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={handleConfirm} className="inline-flex items-center justify-center gap-1 rounded-lg bg-foreground px-3 py-2.5 text-sm text-background hover:bg-foreground/90">
                      <ArrowDownToLine className="size-4" /> Send transfer
                    </button>
                    <button onClick={() => setStep("idle")} className="rounded-lg border px-3 py-2.5 text-sm hover:bg-accent/50">Cancel</button>
                  </div>
                ) : (
                  <button
                    onClick={handleDepositClick}
                    disabled={pending || !depositAmount || parseFloat(depositAmount) <= 0}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
                  >
                    {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowDownToLine className="size-4" />}
                    {pending ? "Processing..." : "Deposit"}
                  </button>
                )}

                {step === "done" && (
                  <div className="inline-flex items-center gap-1 text-sm text-emerald-700"><CheckCircle2 className="size-4" />Deposit recorded</div>
                )}
                {depositError && (
                  <div className="space-y-2">
                    <p className="text-sm text-red-600">{depositError}</p>
                    {transferHash && (
                      <button
                        onClick={async () => {
                          try {
                            setStep("recording");
                            await recordDeposit(transferHash, lastTransferAmount ?? depositAmount);
                            setStep("done");
                            fetchData();
                            setDepositError(null);
                          } catch (err) {
                            setDepositError(err instanceof Error ? err.message : "Retry failed");
                            setStep("idle");
                          }
                        }}
                        className="rounded border px-3 py-1.5 text-xs hover:bg-accent/50"
                      >
                        Retry recording deposit
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardContent className="space-y-3 py-4">
            <span className="text-sm font-medium">Your position</span>
            {!isConnected ? (
              <p className="text-sm text-muted-foreground">Connect wallet to view your position.</p>
            ) : !position ? (
              <p className="text-sm text-muted-foreground">No deposits yet.</p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg border p-2.5">
                    <p className="text-muted-foreground">Deposited</p>
                    <p className="font-mono font-semibold">${position.totalDeposited.toFixed(2)}</p>
                  </div>
                  <div className="rounded-lg border p-2.5">
                    <p className="text-muted-foreground">Current</p>
                    <p className="font-mono font-semibold">${position.currentValue.toFixed(2)}</p>
                  </div>
                  <div className="rounded-lg border p-2.5">
                    <p className="text-muted-foreground">P&L</p>
                    <p className={`font-mono font-semibold ${position.pnl >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {position.pnl >= 0 ? "+" : ""}${position.pnl.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {position.deposits.map((dep) => (
                    <div key={dep.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-mono">${dep.amount.toFixed(2)} cUSD</div>
                        <Badge variant="outline" className="text-[10px]">{dep.status}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatTimeAgo(dep.timestamp)} • shares {dep.sharesIssued.toFixed(4)}
                      </div>
                      <div className="flex items-center justify-between">
                        {dep.txHash ? (
                          <a href={`https://celoscan.io/tx/${dep.txHash}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                            Tx <ExternalLink className="size-3" />
                          </a>
                        ) : <span />}

                        {dep.status === "active" && (
                          <button
                            onClick={() => handleWithdraw(dep.id)}
                            disabled={withdrawingId === dep.id}
                            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-accent/50 disabled:opacity-50"
                          >
                            {withdrawingId === dep.id ? <Loader2 className="size-3 animate-spin" /> : <ArrowUpFromLine className="size-3" />}
                            Withdraw
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {withdrawError && <p className="text-sm text-red-600">{withdrawError}</p>}
              </>
            )}
          </CardContent>
        </Card>

        <details className="rounded-lg border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium">
            Portfolio allocation
            <ChevronDown className="size-4 text-muted-foreground" />
          </summary>
          <div className="px-4 pb-4">
            {!portfolio ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              <div className="space-y-2">
                {portfolio.holdings.map((h) => (
                  <div key={h.token} className="rounded-lg border p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{h.token}</span>
                      <span className="font-mono">{h.actualPct.toFixed(1)}% / {h.targetPct}%</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-muted">
                      <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${Math.min(100, h.actualPct)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </details>
      </main>
      <Footer />
    </div>
  );
}
