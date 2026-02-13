"use client";

import { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatAddress, formatTimeAgo } from "@/lib/format";
import {
  useAccount,
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from "wagmi";
import { parseUnits, formatUnits, erc20Abi } from "viem";
import {
  Vault,
  TrendingUp,
  Users,
  Coins,
  ArrowDownToLine,
  ArrowUpFromLine,
  ExternalLink,
  Loader2,
  CheckCircle2,
  ChevronRight,
  AlertTriangle,
  PieChart,
  Settings2,
  ShieldCheck,
  CalendarPlus,
  Trash2,
  ArrowRightLeft,
  Activity,
} from "lucide-react";
import type { VaultDeposit, VaultMetrics, PortfolioCompositionView } from "@/lib/types";
import { Sparkline } from "@/components/vault/sparkline";

const AGENT_ADDRESS = "0x6652AcDc623b7CCd52E115161d84b949bAf3a303";
const CUSD_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a";

const ALLOC_STORAGE_KEY = "celofx-target-allocation";
const CASHFLOW_STORAGE_KEY = "celofx-cash-flows";

interface PricePoint {
  timestamp: number;
  price: number;
}

interface CashFlow {
  id: string;
  token: string;
  amount: number;
  date: string; // ISO date string
  note: string;
}

interface ForexMovement {
  pair: string;
  rate: number;
  change24h: number;
}

interface VaultData {
  metrics: VaultMetrics;
  priceHistory: PricePoint[];
  deposits: VaultDeposit[];
  position: {
    totalShares: number;
    currentValue: number;
    totalDeposited: number;
    pnl: number;
    deposits: VaultDeposit[];
  } | null;
}

export default function VaultPage() {
  const { address, isConnected } = useAccount();
  const [data, setData] = useState<VaultData | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioCompositionView | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [step, setStep] = useState<
    "idle" | "confirm" | "approving" | "transferring" | "recording" | "done"
  >("idle");
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  // ─── Configurable allocation ───
  const [allocCusd, setAllocCusd] = useState(60);
  const [allocCeur, setAllocCeur] = useState(25);
  const [allocCreal, setAllocCreal] = useState(15);
  const [allocSaved, setAllocSaved] = useState(false);

  // ─── Cash flows ───
  const [cashFlows, setCashFlows] = useState<CashFlow[]>([]);
  const [cfToken, setCfToken] = useState("cUSD");
  const [cfAmount, setCfAmount] = useState("");
  const [cfDate, setCfDate] = useState("");
  const [cfNote, setCfNote] = useState("");

  // ─── Risk metrics ───
  const [forexMovements, setForexMovements] = useState<ForexMovement[]>([]);
  const [rebalanceCount, setRebalanceCount] = useState(0);

  // Load allocation from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(ALLOC_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setAllocCusd(parsed.cUSD ?? 60);
        setAllocCeur(parsed.cEUR ?? 25);
        setAllocCreal(parsed.cREAL ?? 15);
      }
    } catch { /* use defaults */ }
  }, []);

  // Load cash flows from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CASHFLOW_STORAGE_KEY);
      if (stored) setCashFlows(JSON.parse(stored));
    } catch { /* use defaults */ }
  }, []);

  // Fetch forex movements for risk metrics
  useEffect(() => {
    fetch("/api/market-data/forex")
      .then((r) => r.json())
      .then((data) => {
        if (data.rates) {
          setForexMovements(
            data.rates.map((r: { pair: string; rate: number; change24h: number }) => ({
              pair: r.pair,
              rate: r.rate,
              change24h: r.change24h,
            }))
          );
        }
      })
      .catch(() => {});

    // Count rebalance trades
    fetch("/api/trades")
      .then((r) => r.json())
      .then((data) => {
        if (data.trades) {
          const rebalances = data.trades.filter(
            (t: { spreadPct?: number }) => t.spreadPct === 999
          );
          setRebalanceCount(rebalances.length);
        }
      })
      .catch(() => {});
  }, []);

  const handleAllocSave = () => {
    const total = allocCusd + allocCeur + allocCreal;
    if (Math.abs(total - 100) > 1) return;
    localStorage.setItem(
      ALLOC_STORAGE_KEY,
      JSON.stringify({ cUSD: allocCusd, cEUR: allocCeur, cREAL: allocCreal })
    );
    setAllocSaved(true);
    setTimeout(() => setAllocSaved(false), 2000);
    // Refetch portfolio with new allocation
    fetch(`/api/vault/portfolio?cUSD=${allocCusd}&cEUR=${allocCeur}&cREAL=${allocCreal}`)
      .then((r) => r.json())
      .then((p) => setPortfolio(p))
      .catch(() => {});
  };

  const handleAllocSlider = (
    token: "cUSD" | "cEUR" | "cREAL",
    value: number
  ) => {
    // When one slider moves, adjust the others proportionally to keep sum=100
    if (token === "cUSD") {
      const remaining = 100 - value;
      const eurRatio = allocCeur / (allocCeur + allocCreal || 1);
      setAllocCusd(value);
      setAllocCeur(Math.round(remaining * eurRatio));
      setAllocCreal(remaining - Math.round(remaining * eurRatio));
    } else if (token === "cEUR") {
      const remaining = 100 - value;
      const usdRatio = allocCusd / (allocCusd + allocCreal || 1);
      setAllocCeur(value);
      setAllocCusd(Math.round(remaining * usdRatio));
      setAllocCreal(remaining - Math.round(remaining * usdRatio));
    } else {
      const remaining = 100 - value;
      const usdRatio = allocCusd / (allocCusd + allocCeur || 1);
      setAllocCreal(value);
      setAllocCusd(Math.round(remaining * usdRatio));
      setAllocCeur(remaining - Math.round(remaining * usdRatio));
    }
  };

  const addCashFlow = () => {
    if (!cfAmount || !cfDate) return;
    const flow: CashFlow = {
      id: Date.now().toString(),
      token: cfToken,
      amount: Number(cfAmount),
      date: cfDate,
      note: cfNote,
    };
    const updated = [...cashFlows, flow];
    setCashFlows(updated);
    localStorage.setItem(CASHFLOW_STORAGE_KEY, JSON.stringify(updated));
    setCfAmount("");
    setCfDate("");
    setCfNote("");
  };

  const removeCashFlow = (id: string) => {
    const updated = cashFlows.filter((f) => f.id !== id);
    setCashFlows(updated);
    localStorage.setItem(CASHFLOW_STORAGE_KEY, JSON.stringify(updated));
  };

  // Read user's cUSD balance
  const { data: rawBalance } = useReadContract({
    address: CUSD_ADDRESS as `0x${string}`,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const cusdBalance = rawBalance ? parseFloat(formatUnits(rawBalance, 18)) : 0;

  const {
    writeContract: writeApprove,
    data: approveHash,
    reset: resetApprove,
  } = useWriteContract();

  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  const {
    writeContract: writeTransfer,
    data: transferHash,
    reset: resetTransfer,
  } = useWriteContract();

  const { isSuccess: transferConfirmed } = useWaitForTransactionReceipt({
    hash: transferHash,
  });

  const fetchData = useCallback(async () => {
    const url = address ? `/api/vault?address=${address}` : "/api/vault";
    // Use stored allocation or defaults
    let allocParams = "";
    try {
      const stored = localStorage.getItem(ALLOC_STORAGE_KEY);
      if (stored) {
        const p = JSON.parse(stored);
        allocParams = `?cUSD=${p.cUSD}&cEUR=${p.cEUR}&cREAL=${p.cREAL}`;
      }
    } catch { /* defaults */ }
    const [res, portfolioRes] = await Promise.all([
      fetch(url),
      fetch(`/api/vault/portfolio${allocParams}`).catch(() => null),
    ]);
    const json = await res.json();
    setData(json);
    if (portfolioRes?.ok) {
      const pJson = await portfolioRes.json();
      setPortfolio(pJson);
    }
  }, [address]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // After approval confirmed, send transfer
  useEffect(() => {
    if (approveConfirmed && step === "approving" && depositAmount) {
      setStep("transferring");
      const amount = parseUnits(depositAmount, 18);
      writeTransfer({
        address: CUSD_ADDRESS as `0x${string}`,
        abi: erc20Abi,
        functionName: "transfer",
        args: [AGENT_ADDRESS as `0x${string}`, amount],
      });
    }
  }, [approveConfirmed, step, depositAmount, writeTransfer]);

  // After transfer confirmed, record deposit
  useEffect(() => {
    if (
      transferConfirmed &&
      step === "transferring" &&
      address &&
      transferHash
    ) {
      setStep("recording");
      setDepositError(null);
      fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deposit",
          depositor: address,
          amount: parseFloat(depositAmount),
          txHash: transferHash,
        }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: "Recording failed" }));
            throw new Error(err.error || "Recording failed");
          }
          setStep("done");
          setDepositAmount("");
          fetchData();
          setTimeout(() => {
            setStep("idle");
            resetApprove();
            resetTransfer();
          }, 3000);
        })
        .catch((err) => {
          setDepositError(err instanceof Error ? err.message : "Deposit recording failed");
          setStep("idle");
        });
    }
  }, [
    transferConfirmed,
    step,
    address,
    transferHash,
    depositAmount,
    fetchData,
    resetApprove,
    resetTransfer,
  ]);

  const handleDepositClick = () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) return;
    setDepositError(null);
    setStep("confirm");
  };

  const handleConfirm = () => {
    setStep("approving");
    const amount = parseUnits(depositAmount, 18);
    writeApprove({
      address: CUSD_ADDRESS as `0x${string}`,
      abi: erc20Abi,
      functionName: "approve",
      args: [AGENT_ADDRESS as `0x${string}`, amount],
    });
  };

  const handleWithdraw = async (depositId: string) => {
    if (!address) return;
    setWithdrawingId(depositId);
    setWithdrawError(null);
    try {
      const res = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "withdraw",
          depositId,
          depositor: address,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setWithdrawError(json.error || "Withdrawal failed");
        return;
      }
      await fetchData();
    } catch {
      setWithdrawError("Withdrawal failed — please try again");
    } finally {
      setWithdrawingId(null);
    }
  };

  const metrics = data?.metrics;
  const isTxPending =
    step === "approving" || step === "transferring" || step === "recording";
  const parsedAmount = parseFloat(depositAmount) || 0;

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 px-6 py-6 max-w-6xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-2xl font-display tracking-tight">
            Hedging
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-lg">
            Manage a hedged FX portfolio across Celo stablecoins. The agent monitors
            drift from target allocation and rebalances automatically.
          </p>
        </div>

        {/* Movement Alerts — large FX moves (>1% 24h) */}
        {forexMovements.filter((m) => Math.abs(m.change24h) > 1).length > 0 && (
          <div className="space-y-2">
            {forexMovements
              .filter((m) => Math.abs(m.change24h) > 1)
              .sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))
              .map((m) => (
                <div
                  key={m.pair}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border ${
                    Math.abs(m.change24h) > 2
                      ? "border-red-200 bg-red-50"
                      : "border-amber-200 bg-amber-50"
                  }`}
                >
                  <AlertTriangle
                    className={`size-4 shrink-0 ${
                      Math.abs(m.change24h) > 2
                        ? "text-red-600"
                        : "text-amber-600"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-medium ${
                        Math.abs(m.change24h) > 2
                          ? "text-red-900"
                          : "text-amber-900"
                      }`}
                    >
                      {m.pair} moved{" "}
                      <span className="font-mono">
                        {m.change24h >= 0 ? "+" : ""}
                        {m.change24h.toFixed(2)}%
                      </span>{" "}
                      in 24h
                    </p>
                    <p
                      className={`text-xs ${
                        Math.abs(m.change24h) > 2
                          ? "text-red-700"
                          : "text-amber-700"
                      }`}
                    >
                      Current rate: {m.rate.toFixed(4)} —{" "}
                      {Math.abs(m.change24h) > 2
                        ? "Significant volatility may trigger rebalancing"
                        : "Monitor for portfolio drift impact"}
                    </p>
                  </div>
                  <Activity
                    className={`size-4 shrink-0 ${
                      Math.abs(m.change24h) > 2
                        ? "text-red-400"
                        : "text-amber-400"
                    }`}
                  />
                </div>
              ))}
          </div>
        )}

        {/* Overview Stats */}
        {metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="border rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider">
                <Coins className="size-2.5" />
                Total Value Locked
              </div>
              <p className="text-xl font-mono font-bold">
                ${metrics.tvl.toFixed(2)}
              </p>
              <p className="text-[10px] text-muted-foreground">cUSD in vault</p>
            </div>
            <div className="border rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider">
                <TrendingUp className="size-2.5" />
                Share Price
              </div>
              <p className="text-xl font-mono font-bold">
                ${metrics.sharePrice.toFixed(4)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                started at $1.0000
              </p>
            </div>
            <div className="border rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider">
                <Vault className="size-2.5" />
                Est. APY
              </div>
              <p className="text-xl font-mono font-bold text-emerald-600">
                {metrics.apyEstimate.toFixed(1)}%
              </p>
              <p className="text-[10px] text-muted-foreground">annualized</p>
            </div>
            <div className="border rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider">
                <Users className="size-2.5" />
                Depositors
              </div>
              <p className="text-xl font-mono font-bold">
                {metrics.depositors}
              </p>
              <p className="text-[10px] text-muted-foreground">active</p>
            </div>
          </div>
        )}

        {/* Share Price Chart */}
        {data?.priceHistory && data.priceHistory.length >= 2 && metrics && (
          <Card className="gap-0 py-0">
            <CardContent className="py-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Share Price</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-lg font-mono font-bold">
                    ${metrics.sharePrice.toFixed(4)}
                  </span>
                  {metrics.sharePrice > 1 && (
                    <span className="text-xs font-mono text-emerald-600">
                      +{((metrics.sharePrice - 1) * 100).toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>
              <Sparkline
                data={data.priceHistory}
                width={800}
                height={80}
                showArea
                showLabels
                className="w-full"
              />
            </CardContent>
          </Card>
        )}

        {/* Portfolio Allocation */}
        {portfolio && portfolio.holdings.length > 0 && (
          <Card className="gap-0 py-0">
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PieChart className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Portfolio Allocation</span>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${
                    portfolio.needsRebalance
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}
                >
                  {portfolio.needsRebalance
                    ? `${portfolio.maxDriftPct.toFixed(1)}% drift`
                    : "Balanced"}
                </Badge>
              </div>

              <div className="space-y-2">
                {portfolio.holdings.map((h) => {
                  const isOverweight = h.driftPct > 0;
                  const absDrift = Math.abs(h.driftPct);
                  const driftColor =
                    absDrift > 5 ? "text-amber-600" : "text-muted-foreground";
                  return (
                    <div key={h.token} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-medium w-12">{h.token}</span>
                          <span className="font-mono text-muted-foreground">
                            {h.balance.toFixed(2)}
                          </span>
                          <span className="text-muted-foreground">
                            (${h.valueCusd.toFixed(2)})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`font-mono ${driftColor}`}>
                            {isOverweight ? "+" : ""}
                            {h.driftPct.toFixed(1)}%
                          </span>
                          <span className="font-mono text-muted-foreground text-[10px]">
                            {h.actualPct.toFixed(1)}% / {h.targetPct}%
                          </span>
                        </div>
                      </div>
                      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                        {/* Target marker */}
                        <div
                          className="absolute top-0 h-full w-0.5 bg-muted-foreground/30 z-10"
                          style={{ left: `${Math.min(h.targetPct, 100)}%` }}
                        />
                        {/* Actual fill */}
                        <div
                          className={`h-full rounded-full transition-all ${
                            absDrift > 5
                              ? "bg-amber-400"
                              : "bg-emerald-400"
                          }`}
                          style={{ width: `${Math.min(h.actualPct, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {portfolio.needsRebalance && (
                <div className="flex items-start gap-2 border border-amber-200 bg-amber-50 rounded-lg p-2.5">
                  <AlertTriangle className="size-3.5 text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-amber-800">
                    Portfolio drift exceeds 5%. Agent will rebalance on next scan.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t">
                <span>
                  Total: ${portfolio.totalValueCusd.toFixed(2)} cUSD
                </span>
                <span>Target: {allocCusd}% cUSD / {allocCeur}% cEUR / {allocCreal}% cREAL</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Configure Target Allocation */}
        <Card className="gap-0 py-0">
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">Target Allocation</span>
              </div>
              <button
                onClick={handleAllocSave}
                disabled={Math.abs(allocCusd + allocCeur + allocCreal - 100) > 1}
                className="px-3 py-1 text-xs font-medium bg-foreground text-background rounded-md hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {allocSaved ? (
                  <>
                    <CheckCircle2 className="size-3" />
                    Saved
                  </>
                ) : (
                  "Save"
                )}
              </button>
            </div>

            <div className="space-y-3">
              {[
                { token: "cUSD", value: allocCusd, setter: "cUSD" as const, color: "accent-emerald-500" },
                { token: "cEUR", value: allocCeur, setter: "cEUR" as const, color: "accent-blue-500" },
                { token: "cREAL", value: allocCreal, setter: "cREAL" as const, color: "accent-amber-500" },
              ].map(({ token, value, setter }) => (
                <div key={token} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium w-12">{token}</span>
                    <span className="font-mono text-muted-foreground">{value}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={value}
                    onChange={(e) => handleAllocSlider(setter, Number(e.target.value))}
                    className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-foreground [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t">
              <span>
                Total: {allocCusd + allocCeur + allocCreal}%
                {Math.abs(allocCusd + allocCeur + allocCreal - 100) > 1 && (
                  <span className="text-red-500 ml-1">(must equal 100%)</span>
                )}
              </span>
              <span>Saved to browser, applied on next agent scan</span>
            </div>
          </CardContent>
        </Card>

        {/* Risk Metrics + Cash Flows side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Risk Metrics */}
          <Card className="gap-0 py-0">
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">Risk Metrics</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="border rounded-lg p-2.5 space-y-0.5">
                  <p className="text-[10px] text-muted-foreground">Max Drift</p>
                  <p className={`text-lg font-mono font-bold ${
                    portfolio && portfolio.maxDriftPct > 5 ? "text-amber-600" : "text-emerald-600"
                  }`}>
                    {portfolio ? `${portfolio.maxDriftPct.toFixed(1)}%` : "—"}
                  </p>
                </div>
                <div className="border rounded-lg p-2.5 space-y-0.5">
                  <p className="text-[10px] text-muted-foreground">Rebalances</p>
                  <p className="text-lg font-mono font-bold">{rebalanceCount}</p>
                </div>
                <div className="border rounded-lg p-2.5 space-y-0.5">
                  <p className="text-[10px] text-muted-foreground">Drift Threshold</p>
                  <p className="text-lg font-mono font-bold">5%</p>
                </div>
                <div className="border rounded-lg p-2.5 space-y-0.5">
                  <p className="text-[10px] text-muted-foreground">Portfolio Value</p>
                  <p className="text-lg font-mono font-bold">
                    ${portfolio ? portfolio.totalValueCusd.toFixed(2) : "—"}
                  </p>
                </div>
              </div>

              {/* 24h Currency Movements */}
              {forexMovements.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider">
                    <Activity className="size-2.5" />
                    24h Currency Movement
                  </div>
                  <div className="space-y-1">
                    {forexMovements.slice(0, 4).map((m) => (
                      <div
                        key={m.pair}
                        className="flex items-center justify-between text-xs px-2 py-1 rounded border"
                      >
                        <span className="font-medium">{m.pair}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-muted-foreground">
                            {m.rate.toFixed(4)}
                          </span>
                          <span
                            className={`font-mono ${
                              m.change24h >= 0 ? "text-emerald-600" : "text-red-600"
                            }`}
                          >
                            {m.change24h >= 0 ? "+" : ""}
                            {m.change24h.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Expected Cash Flows */}
          <Card className="gap-0 py-0">
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center gap-2">
                <CalendarPlus className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">Expected Cash Flows</span>
              </div>

              <p className="text-xs text-muted-foreground">
                Add expected inflows to optimize hedging. The agent adjusts rebalancing to account for upcoming receipts.
              </p>

              {/* Add form */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <select
                    value={cfToken}
                    onChange={(e) => setCfToken(e.target.value)}
                    className="px-2 py-1.5 text-xs border rounded-lg bg-background"
                  >
                    <option value="cUSD">cUSD</option>
                    <option value="cEUR">cEUR</option>
                    <option value="cREAL">cREAL</option>
                  </select>
                  <input
                    type="number"
                    placeholder="Amount"
                    value={cfAmount}
                    onChange={(e) => setCfAmount(e.target.value)}
                    className="w-20 px-2 py-1.5 text-xs border rounded-lg bg-background font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <input
                    type="date"
                    value={cfDate}
                    onChange={(e) => setCfDate(e.target.value)}
                    className="flex-1 px-2 py-1.5 text-xs border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button
                    onClick={addCashFlow}
                    disabled={!cfAmount || !cfDate}
                    className="px-2.5 py-1.5 text-xs font-medium bg-foreground text-background rounded-lg hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Note (optional): e.g. Client payment"
                  value={cfNote}
                  onChange={(e) => setCfNote(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>

              {/* Pending cash flows */}
              {cashFlows.length > 0 ? (
                <div className="space-y-1">
                  {cashFlows
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .map((flow) => {
                      const daysUntil = Math.ceil(
                        (new Date(flow.date).getTime() - Date.now()) / 86400000
                      );
                      return (
                        <div
                          key={flow.id}
                          className="flex items-center justify-between py-1.5 px-2 rounded border text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <ArrowRightLeft className="size-3 text-blue-500 shrink-0" />
                            <span className="font-mono font-medium">
                              +{flow.amount} {flow.token}
                            </span>
                            <span className="text-muted-foreground">
                              {daysUntil > 0
                                ? `in ${daysUntil}d`
                                : daysUntil === 0
                                  ? "today"
                                  : `${Math.abs(daysUntil)}d ago`}
                            </span>
                            {flow.note && (
                              <span className="text-muted-foreground truncate max-w-[100px]">
                                {flow.note}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => removeCashFlow(flow.id)}
                            className="p-1 text-muted-foreground hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        </div>
                      );
                    })}

                  {/* Summary */}
                  <div className="text-[10px] text-muted-foreground pt-1 border-t">
                    {(() => {
                      const totals: Record<string, number> = {};
                      cashFlows.forEach((f) => {
                        totals[f.token] = (totals[f.token] || 0) + f.amount;
                      });
                      return (
                        <span>
                          Expected inflows:{" "}
                          {Object.entries(totals)
                            .map(([t, a]) => `+${a} ${t}`)
                            .join(", ")}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground py-2 text-center border rounded-lg bg-muted/30">
                  No expected cash flows. Add inflows to optimize hedging timing.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Deposit Form */}
          <Card className="gap-0 py-0">
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center gap-2">
                <ArrowDownToLine className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">Deposit cUSD</span>
              </div>

              {!isConnected ? (
                <p className="text-sm text-muted-foreground py-4">
                  Connect your wallet to deposit cUSD into the hedging vault.
                </p>
              ) : step === "confirm" ? (
                /* ── Confirmation step ── */
                <div className="space-y-3">
                  <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="size-4 text-amber-600 mt-0.5 shrink-0" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-amber-900">
                          Confirm Deposit
                        </p>
                        <p className="text-xs text-amber-800">
                          You&apos;re about to transfer{" "}
                          <span className="font-mono font-bold">
                            {parsedAmount.toFixed(2)} cUSD
                          </span>{" "}
                          to the agent wallet{" "}
                          <span className="font-mono">
                            ({formatAddress(AGENT_ADDRESS)})
                          </span>
                          . The agent will trade this capital on Mento and
                          profits accrue to your shares.
                        </p>
                        {metrics && (
                          <p className="text-xs text-amber-700">
                            You&apos;ll receive ~
                            <span className="font-mono font-medium">
                              {(parsedAmount / metrics.sharePrice).toFixed(2)}{" "}
                              shares
                            </span>{" "}
                            at ${metrics.sharePrice.toFixed(4)}/share
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setStep("idle")}
                      className="flex-1 px-4 py-2 text-sm font-medium border rounded-lg hover:bg-accent transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirm}
                      className="flex-1 px-4 py-2 text-sm font-medium bg-foreground text-background rounded-lg hover:bg-foreground/90 transition-colors"
                    >
                      Confirm &amp; Approve
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Input step ── */
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Amount</span>
                      <span>
                        Balance:{" "}
                        <button
                          onClick={() =>
                            setDepositAmount(cusdBalance.toFixed(2))
                          }
                          className="font-mono text-foreground hover:underline"
                        >
                          {cusdBalance.toFixed(2)} cUSD
                        </button>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="0.00"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        disabled={isTxPending}
                        className="flex-1 px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 font-mono"
                        min="0"
                        step="0.01"
                      />
                      <button
                        onClick={() =>
                          setDepositAmount(cusdBalance.toFixed(2))
                        }
                        disabled={isTxPending || cusdBalance === 0}
                        className="px-2.5 py-2 text-xs font-medium border rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
                      >
                        Max
                      </button>
                      <button
                        onClick={
                          isTxPending ? undefined : handleDepositClick
                        }
                        disabled={isTxPending || parsedAmount <= 0}
                        className="px-4 py-2 text-sm font-medium bg-foreground text-background rounded-lg hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shrink-0"
                      >
                        {step === "approving" && (
                          <>
                            <Loader2 className="size-3 animate-spin" />
                            Approving...
                          </>
                        )}
                        {step === "transferring" && (
                          <>
                            <Loader2 className="size-3 animate-spin" />
                            Transferring...
                          </>
                        )}
                        {step === "recording" && (
                          <>
                            <Loader2 className="size-3 animate-spin" />
                            Recording...
                          </>
                        )}
                        {step === "done" && (
                          <>
                            <CheckCircle2 className="size-3" />
                            Done
                          </>
                        )}
                        {step === "idle" && "Deposit"}
                      </button>
                    </div>
                    {metrics && parsedAmount > 0 && step === "idle" && (
                      <p className="text-xs text-muted-foreground">
                        ~{(parsedAmount / metrics.sharePrice).toFixed(2)} shares
                        at ${metrics.sharePrice.toFixed(4)}/share
                      </p>
                    )}
                    {parsedAmount > cusdBalance && cusdBalance > 0 && (
                      <p className="text-xs text-red-600">
                        Exceeds your cUSD balance
                      </p>
                    )}
                    {depositError && (
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <AlertTriangle className="size-3 shrink-0" />
                        {depositError}
                      </p>
                    )}
                  </div>

                  <div className="border-t pt-2 space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      How it works
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        {
                          n: "1",
                          label: "Deposit",
                          desc: "Transfer cUSD to agent wallet",
                        },
                        {
                          n: "2",
                          label: "Monitor",
                          desc: "Agent waits for profitable spread",
                        },
                        {
                          n: "3",
                          label: "Withdraw",
                          desc: "Redeem shares with profit",
                        },
                      ].map((s) => (
                        <div key={s.n} className="text-center space-y-0.5">
                          <div className="text-[10px] font-mono font-bold text-muted-foreground">
                            {s.n}
                          </div>
                          <p className="text-xs font-medium">{s.label}</p>
                          <p className="text-[10px] text-muted-foreground leading-tight">
                            {s.desc}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Your Position */}
          <Card className="gap-0 py-0">
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center gap-2">
                <ArrowUpFromLine className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">Your Position</span>
              </div>

              {!isConnected ? (
                <p className="text-sm text-muted-foreground py-4">
                  Connect your wallet to view your vault position.
                </p>
              ) : data?.position && data.position.deposits.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="border rounded-lg p-2.5 space-y-0.5">
                      <p className="text-[10px] text-muted-foreground">
                        Your Shares
                      </p>
                      <p className="text-lg font-mono font-bold">
                        {data.position.totalShares.toFixed(2)}
                      </p>
                    </div>
                    <div className="border rounded-lg p-2.5 space-y-0.5">
                      <p className="text-[10px] text-muted-foreground">
                        Current Value
                      </p>
                      <p className="text-lg font-mono font-bold">
                        ${data.position.currentValue.toFixed(2)}
                      </p>
                    </div>
                    <div className="border rounded-lg p-2.5 space-y-0.5">
                      <p className="text-[10px] text-muted-foreground">
                        Deposited
                      </p>
                      <p className="text-lg font-mono font-bold">
                        ${data.position.totalDeposited.toFixed(2)}
                      </p>
                    </div>
                    <div className="border rounded-lg p-2.5 space-y-0.5">
                      <p className="text-[10px] text-muted-foreground">
                        Profit / Loss
                      </p>
                      <p
                        className={`text-lg font-mono font-bold ${
                          data.position.pnl >= 0
                            ? "text-emerald-600"
                            : "text-red-600"
                        }`}
                      >
                        {data.position.pnl >= 0 ? "+" : ""}$
                        {data.position.pnl.toFixed(4)}
                      </p>
                    </div>
                  </div>

                  {withdrawError && (
                    <p className="text-xs text-red-600 flex items-center gap-1 border border-red-200 bg-red-50 rounded-lg p-2">
                      <AlertTriangle className="size-3 shrink-0" />
                      {withdrawError}
                    </p>
                  )}
                  <div className="space-y-1">
                    {data.position.deposits.map((d) => {
                      const currentVal =
                        metrics
                          ? d.sharesIssued * metrics.sharePrice
                          : d.amount;
                      const gain = currentVal - d.amount;
                      return (
                        <div
                          key={d.id}
                          className="flex items-center justify-between py-1.5 px-2 rounded border text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <ChevronRight className="size-3 text-emerald-500" />
                            <span className="font-mono">
                              ${d.amount.toFixed(2)}
                            </span>
                            <span className="text-muted-foreground">
                              &rarr; ${currentVal.toFixed(2)}
                            </span>
                            <span
                              className={`font-mono ${
                                gain >= 0
                                  ? "text-emerald-600"
                                  : "text-red-600"
                              }`}
                            >
                              {gain >= 0 ? "+" : ""}${gain.toFixed(4)}
                            </span>
                            <span className="text-muted-foreground">
                              {formatTimeAgo(d.timestamp)}
                            </span>
                          </div>
                          <button
                            onClick={() => handleWithdraw(d.id)}
                            disabled={withdrawingId === d.id}
                            className="px-2 py-1 text-[10px] font-medium border rounded hover:bg-accent transition-colors disabled:opacity-50"
                          >
                            {withdrawingId === d.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              "Withdraw"
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-4">
                  No deposits yet. Deposit cUSD to start earning from spread
                  arbitrage.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* All Deposits Table */}
        {data?.deposits && data.deposits.length > 0 && (
          <Card className="gap-0 py-0">
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Vault className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">All Deposits</span>
                  <Badge variant="outline" className="text-[10px]">
                    {data.deposits.length}
                  </Badge>
                </div>
              </div>

              <div className="space-y-1">
                {data.deposits.map((d) => {
                  const currentVal =
                    metrics
                      ? d.sharesIssued * metrics.sharePrice
                      : d.amount;
                  const gain = currentVal - d.amount;
                  return (
                    <div
                      key={d.id}
                      className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 transition-colors text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <ChevronRight
                          className={`size-3 ${
                            d.status === "active"
                              ? "text-emerald-500"
                              : "text-muted-foreground"
                          }`}
                        />
                        <span className="font-mono">
                          {formatAddress(d.depositor)}
                        </span>
                        <span className="font-mono font-medium">
                          ${d.amount.toFixed(2)}
                        </span>
                        <span className="text-muted-foreground">
                          &rarr; ${currentVal.toFixed(2)}
                        </span>
                        {d.status === "active" && (
                          <span
                            className={`font-mono ${
                              gain >= 0
                                ? "text-emerald-600"
                                : "text-red-600"
                            }`}
                          >
                            {gain >= 0 ? "+" : ""}${gain.toFixed(4)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            d.status === "active"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {d.status}
                        </Badge>
                        <span className="text-muted-foreground">
                          {formatTimeAgo(d.timestamp)}
                        </span>
                        <a
                          href={`https://celoscan.io/tx/${d.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="size-3" />
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </main>
      <Footer />
    </div>
  );
}
