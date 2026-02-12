"use client";

import { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatAddress, formatTimeAgo } from "@/lib/format";
import { useAccount } from "wagmi";
import {
  Bell,
  Clock,
  CheckCircle2,
  XCircle,
  Target,
  ArrowRight,
  Loader2,
  ExternalLink,
  Plus,
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  Activity,
} from "lucide-react";
import type { FxOrder } from "@/lib/types";
import { setCachedOrders } from "@/lib/local-cache";

const TOKEN_OPTIONS = ["cUSD", "cEUR", "cREAL"];
const DEADLINE_OPTIONS = [
  { label: "12h", hours: 12 },
  { label: "24h", hours: 24 },
  { label: "48h", hours: 48 },
  { label: "7d", hours: 168 },
];

function CountdownTimer({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const remaining = deadline - now;
  if (remaining <= 0) return <span className="text-red-600 font-mono text-xs">Expired</span>;

  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);

  const isUrgent = remaining < 2 * 3_600_000;

  return (
    <span className={`font-mono text-xs ${isUrgent ? "text-amber-600" : "text-muted-foreground"}`}>
      {hours > 0 && `${hours}h `}{minutes}m {seconds}s
    </span>
  );
}

const statusConfig = {
  pending: { color: "bg-blue-50 text-blue-700 border-blue-200", icon: Clock },
  executed: { color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  expired: { color: "bg-muted text-muted-foreground", icon: XCircle },
  cancelled: { color: "bg-muted text-muted-foreground", icon: XCircle },
};

function RateSparkline({ history, target }: { history: { rate: number; timestamp: number }[]; target: number }) {
  if (!history || history.length < 2) return null;
  const rates = history.map((h) => h.rate);
  const min = Math.min(...rates, target) * 0.999;
  const max = Math.max(...rates, target) * 1.001;
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  const points = rates.map((r, i) => `${(i / (rates.length - 1)) * w},${h - ((r - min) / range) * h}`).join(" ");
  const targetY = h - ((target - min) / range) * h;
  return (
    <svg width={w} height={h} className="inline-block">
      <line x1={0} y1={targetY} x2={w} y2={targetY} stroke="currentColor" strokeDasharray="2 2" className="text-muted-foreground/40" strokeWidth={0.5} />
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.5} className={rates[rates.length - 1] >= target ? "text-emerald-500" : "text-blue-500"} />
    </svg>
  );
}

function getMomentum(history: { rate: number; timestamp: number }[], targetRate: number) {
  if (!history || history.length < 3) return "stable" as const;
  const recent = history.slice(-3);
  const delta = recent[2].rate - recent[0].rate;
  const threshold = targetRate * 0.0005;
  if (delta > threshold) return "improving" as const;
  if (delta < -threshold) return "declining" as const;
  return "stable" as const;
}

function getUrgency(deadline: number) {
  const hoursLeft = (deadline - Date.now()) / 3_600_000;
  if (hoursLeft < 2) return "high" as const;
  if (hoursLeft < 12) return "medium" as const;
  return "low" as const;
}

const momentumConfig = {
  improving: { icon: TrendingUp, label: "Improving", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  stable: { icon: Minus, label: "Stable", color: "text-muted-foreground bg-muted/50 border-border" },
  declining: { icon: TrendingDown, label: "Declining", color: "text-red-600 bg-red-50 border-red-200" },
};

const urgencyConfig = {
  high: { icon: Zap, label: "Urgent", color: "text-amber-700 bg-amber-50 border-amber-200" },
  medium: { icon: Clock, label: "Medium", color: "text-blue-600 bg-blue-50 border-blue-200" },
  low: { icon: Clock, label: "Low", color: "text-muted-foreground bg-muted/50 border-border" },
};

export default function TradingPage() {
  const { address, isConnected } = useAccount();
  const [orders, setOrders] = useState<FxOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [fromToken, setFromToken] = useState("cUSD");
  const [toToken, setToToken] = useState("cEUR");
  const [amount, setAmount] = useState("");
  const [targetRate, setTargetRate] = useState("");
  const [deadlineHours, setDeadlineHours] = useState(24);
  const [creating, setCreating] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      const json = await res.json();
      setOrders(json.orders || []);
      setCachedOrders(json.orders || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10_000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleCreate = async () => {
    if (!address || !amount || !targetRate) return;
    setCreating(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          creator: address,
          fromToken,
          toToken,
          amountIn: amount,
          targetRate,
          deadlineHours,
        }),
      });
      if (res.ok) {
        setAmount("");
        setTargetRate("");
        await fetchOrders();
      }
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = async (orderId: string) => {
    if (!address) return;
    setCancellingId(orderId);
    try {
      await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", orderId, creator: address }),
      });
      await fetchOrders();
    } catch {
      // ignore
    } finally {
      setCancellingId(null);
    }
  };

  const pendingOrders = orders.filter((o) => o.status === "pending");
  const executedOrders = orders.filter((o) => o.status === "executed");
  const myOrders = address
    ? orders.filter((o) => o.creator.toLowerCase() === address.toLowerCase())
    : [];
  const myPending = myOrders.filter((o) => o.status === "pending");

  const totalVolume = executedOrders.reduce(
    (sum, o) => sum + parseFloat(o.amountIn),
    0
  );
  const avgFillRate =
    executedOrders.length > 0
      ? executedOrders.reduce((s, o) => s + (o.executedRate || 0), 0) /
        executedOrders.length
      : 0;

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 px-6 py-6 max-w-6xl mx-auto w-full space-y-6">
        <div className="flex items-center gap-3">
          <Bell className="size-5 text-muted-foreground" />
          <h1 className="text-2xl font-display tracking-tight">
            Trading
          </h1>
          <Badge variant="outline" className="text-xs font-mono">
            {pendingOrders.length} active
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground max-w-lg -mt-4">
          Set price alerts on Mento stablecoin rates. The agent monitors 24/7
          and auto-executes when your target is hit.
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="border rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider">
              <Activity className="size-2.5" />
              Active Alerts
            </div>
            <p className="text-xl font-mono font-bold">{pendingOrders.length}</p>
          </div>
          <div className="border rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider">
              <CheckCircle2 className="size-2.5" />
              Executed
            </div>
            <p className="text-xl font-mono font-bold">{executedOrders.length}</p>
          </div>
          <div className="border rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider">
              <Target className="size-2.5" />
              Avg Fill Rate
            </div>
            <p className="text-xl font-mono font-bold">
              {avgFillRate > 0 ? avgFillRate.toFixed(4) : "\u2014"}
            </p>
          </div>
          <div className="border rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider">
              <ArrowRight className="size-2.5" />
              Total Volume
            </div>
            <p className="text-xl font-mono font-bold">
              {totalVolume > 0 ? `$${totalVolume.toFixed(0)}` : "\u2014"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* New Price Alert Form */}
          <Card className="gap-0 py-0">
            <CardContent className="py-4 space-y-4">
              <div className="flex items-center gap-2">
                <Plus className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">New Price Alert</span>
              </div>

              {!isConnected ? (
                <p className="text-sm text-muted-foreground py-4">
                  Connect your wallet to set price alerts.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        I want to swap
                      </label>
                      <select
                        value={fromToken}
                        onChange={(e) => setFromToken(e.target.value)}
                        className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {TOKEN_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        To receive
                      </label>
                      <select
                        value={toToken}
                        onChange={(e) => setToToken(e.target.value)}
                        className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {TOKEN_OPTIONS.filter((t) => t !== fromToken).map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                      Amount ({fromToken})
                    </label>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                      When rate reaches ({toToken} per {fromToken})
                    </label>
                    <input
                      type="number"
                      placeholder={
                        toToken === "cEUR"
                          ? "e.g. 0.845"
                          : toToken === "cREAL"
                            ? "e.g. 5.25"
                            : "e.g. 1.00"
                      }
                      value={targetRate}
                      onChange={(e) => setTargetRate(e.target.value)}
                      className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                      min="0"
                      step="0.001"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      The agent auto-executes your swap when the Mento rate hits this target
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                      Keep watching for
                    </label>
                    <div className="flex gap-2">
                      {DEADLINE_OPTIONS.map((opt) => (
                        <button
                          key={opt.hours}
                          onClick={() => setDeadlineHours(opt.hours)}
                          className={`flex-1 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors ${
                            deadlineHours === opt.hours
                              ? "bg-foreground text-background border-foreground"
                              : "hover:bg-accent"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleCreate}
                    disabled={
                      creating ||
                      !amount ||
                      !targetRate ||
                      parseFloat(amount) <= 0 ||
                      parseFloat(targetRate) <= 0
                    }
                    className="w-full px-4 py-2.5 text-sm font-medium bg-foreground text-background rounded-lg hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="size-3 animate-spin" />
                        Setting alert...
                      </>
                    ) : (
                      "Set Alert"
                    )}
                  </button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Your Alerts */}
          <Card className="gap-0 py-0">
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center gap-2">
                <Bell className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">Your Alerts</span>
                {myPending.length > 0 && (
                  <Badge variant="outline" className="text-[10px]">
                    {myPending.length} active
                  </Badge>
                )}
              </div>

              {!isConnected ? (
                <p className="text-sm text-muted-foreground py-4">
                  Connect your wallet to view your alerts.
                </p>
              ) : myOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  No alerts yet. Set your first price alert to get started.
                </p>
              ) : (
                <div className="space-y-2">
                  {myOrders.map((order) => {
                    const cfg = statusConfig[order.status];
                    const StatusIcon = cfg.icon;
                    return (
                      <div
                        key={order.id}
                        className="border rounded-lg p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono font-medium">
                              {order.amountIn} {order.fromToken}
                            </span>
                            <ArrowRight className="size-3 text-muted-foreground" />
                            <span className="text-sm font-mono font-medium">
                              {order.toToken}
                            </span>
                          </div>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${cfg.color}`}
                          >
                            <StatusIcon className="size-2.5 mr-1" />
                            {order.status}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <div className="space-y-0.5">
                            <p className="text-muted-foreground">
                              Target:{" "}
                              <span className="font-mono text-foreground">
                                {order.targetRate}
                              </span>
                            </p>
                            {order.executedRate && (
                              <p className="text-emerald-600">
                                Filled:{" "}
                                <span className="font-mono">
                                  {order.executedRate.toFixed(4)}
                                </span>
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {order.status === "pending" && order.rateHistory && (
                              <RateSparkline history={order.rateHistory} target={order.targetRate} />
                            )}
                            <div className="text-right space-y-0.5">
                              {order.status === "pending" && (
                                <CountdownTimer deadline={order.deadline} />
                              )}
                              {order.checksCount != null && order.checksCount > 0 && (
                                <p className="text-[10px] text-muted-foreground">
                                  {order.checksCount} checks
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {order.status === "pending" && (() => {
                          const momentum = getMomentum(order.rateHistory || [], order.targetRate);
                          const urgency = getUrgency(order.deadline);
                          const mCfg = momentumConfig[momentum];
                          const uCfg = urgencyConfig[urgency];
                          const MIcon = mCfg.icon;
                          const UIcon = uCfg.icon;
                          return (
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${mCfg.color}`}>
                                <MIcon className="size-2.5 mr-0.5" />
                                {mCfg.label}
                              </Badge>
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${uCfg.color}`}>
                                <UIcon className="size-2.5 mr-0.5" />
                                {uCfg.label}
                              </Badge>
                            </div>
                          );
                        })()}

                        {order.agentReasoning && (
                          <div className="border-t pt-2 flex gap-2">
                            <Brain className="size-3.5 text-violet-500 mt-0.5 shrink-0" />
                            <p className="text-[11px] text-foreground/80 leading-relaxed">
                              {order.agentReasoning}
                            </p>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">
                            {formatTimeAgo(order.createdAt)}
                          </span>
                          <div className="flex items-center gap-2">
                            {order.executedTxHash && (
                              <a
                                href={`https://celoscan.io/tx/${order.executedTxHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <ExternalLink className="size-3" />
                              </a>
                            )}
                            {order.status === "pending" && (
                              <button
                                onClick={() => handleCancel(order.id)}
                                disabled={cancellingId === order.id}
                                className="px-2 py-1 text-[10px] font-medium border rounded hover:bg-accent transition-colors disabled:opacity-50"
                              >
                                {cancellingId === order.id ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  "Cancel"
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* All Alerts Table */}
        {orders.length > 0 && (
          <Card className="gap-0 py-0">
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">All Alerts</span>
                <Badge variant="outline" className="text-[10px]">
                  {orders.length}
                </Badge>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-1">
                  {orders.map((order) => {
                    const cfg = statusConfig[order.status];
                    return (
                      <div
                        key={order.id}
                        className="py-2 px-2 rounded hover:bg-muted/50 transition-colors text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-muted-foreground">
                              {formatAddress(order.creator)}
                            </span>
                            <span className="font-mono font-medium">
                              {order.amountIn} {order.fromToken}
                            </span>
                            <ArrowRight className="size-2.5 text-muted-foreground" />
                            <span className="font-mono font-medium">
                              {order.toToken}
                            </span>
                            <span className="text-muted-foreground">
                              @ {order.targetRate}
                            </span>
                            {order.status === "pending" && order.rateHistory && order.rateHistory.length >= 2 && (
                              <RateSparkline history={order.rateHistory} target={order.targetRate} />
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {order.status === "pending" && (
                              <CountdownTimer deadline={order.deadline} />
                            )}
                            {order.executedRate && (
                              <span className="font-mono text-emerald-600">
                                {order.executedRate.toFixed(4)}
                              </span>
                            )}
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${cfg.color}`}
                            >
                              {order.status}
                            </Badge>
                            <span className="text-muted-foreground">
                              {formatTimeAgo(order.createdAt)}
                            </span>
                            {order.executedTxHash && (
                              <a
                                href={`https://celoscan.io/tx/${order.executedTxHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <ExternalLink className="size-3" />
                              </a>
                            )}
                          </div>
                        </div>
                        {order.agentReasoning && (
                          <div className="flex items-start gap-1.5 pl-1">
                            <Brain className="size-3 text-violet-500 mt-0.5 shrink-0" />
                            <p className="text-[11px] text-foreground/70 leading-relaxed">
                              {order.agentReasoning}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
      <Footer />
    </div>
  );
}
