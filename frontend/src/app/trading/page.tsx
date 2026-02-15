"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatAddress, formatTimeAgo } from "@/lib/format";
import { useAccount } from "wagmi";
import { toast } from "sonner";
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
  Percent,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import type { FxOrder, AlertConditionType } from "@/lib/types";
import { setCachedOrders } from "@/lib/local-cache";

const TOKEN_OPTIONS = ["cUSD", "cEUR", "cREAL", "USDC", "USDT"];
const DEADLINE_OPTIONS = [
  { label: "12h", hours: 12 },
  { label: "24h", hours: 24 },
  { label: "48h", hours: 48 },
  { label: "7d", hours: 168 },
];

const CONDITION_TYPES: { value: AlertConditionType; label: string; desc: string }[] = [
  { value: "rate_reaches", label: "Rate reaches", desc: "Execute when rate hits your target" },
  { value: "pct_change", label: "% change", desc: "Execute on rate movement %" },
  { value: "rate_crosses_above", label: "Crosses above", desc: "Execute when rate goes above threshold" },
  { value: "rate_crosses_below", label: "Crosses below", desc: "Execute when rate drops below threshold" },
];

const PCT_TIMEFRAMES = [
  { label: "1h", value: "1h" as const },
  { label: "4h", value: "4h" as const },
  { label: "24h", value: "24h" as const },
];

function CountdownTimer({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(deadline);

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

// ─── Rate Chart ───
function RateChart({ history, target }: { history: { rate: number; timestamp: number }[]; target?: number }) {
  if (!history || history.length < 2) return null;
  const rates = history.map((h) => h.rate);
  const allVals = target ? [...rates, target] : rates;
  const min = Math.min(...allVals) * 0.9985;
  const max = Math.max(...allVals) * 1.0015;
  const range = max - min || 0.001;
  const w = 240;
  const h = 64;
  const padding = 4;

  const points = rates.map(
    (r, i) =>
      `${padding + (i / (rates.length - 1)) * (w - padding * 2)},${
        padding + (h - padding * 2) - ((r - min) / range) * (h - padding * 2)
      }`
  );
  const linePath = points.join(" ");

  // Area fill
  const firstX = padding;
  const lastX = padding + ((rates.length - 1) / (rates.length - 1)) * (w - padding * 2);
  const areaPath = `M${points[0]} ${points.slice(1).map((p) => `L${p}`).join(" ")} L${lastX},${h - padding} L${firstX},${h - padding} Z`;

  const targetY = target
    ? padding + (h - padding * 2) - ((target - min) / range) * (h - padding * 2)
    : null;

  const lastRate = rates[rates.length - 1];
  const firstRate = rates[0];
  const isUp = lastRate >= firstRate;

  return (
    <div className="space-y-1">
      <svg width={w} height={h} className="w-full" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        {/* Area fill */}
        <path
          d={areaPath}
          fill={isUp ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.08)"}
        />
        {/* Target line */}
        {targetY !== null && (
          <>
            <line
              x1={padding}
              y1={targetY}
              x2={w - padding}
              y2={targetY}
              stroke="currentColor"
              strokeDasharray="4 3"
              className="text-amber-400"
              strokeWidth={1}
            />
            <text
              x={w - padding - 1}
              y={targetY - 3}
              textAnchor="end"
              className="fill-amber-500"
              fontSize="7"
              fontFamily="monospace"
            >
              target
            </text>
          </>
        )}
        {/* Rate line */}
        <polyline
          points={linePath}
          fill="none"
          stroke={isUp ? "#10b981" : "#ef4444"}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Current dot */}
        <circle
          cx={parseFloat(points[points.length - 1].split(",")[0])}
          cy={parseFloat(points[points.length - 1].split(",")[1])}
          r={2.5}
          fill={isUp ? "#10b981" : "#ef4444"}
        />
      </svg>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
        <span>{rates[0].toFixed(4)}</span>
        <span className={isUp ? "text-emerald-600" : "text-red-600"}>
          {lastRate.toFixed(4)} ({isUp ? "+" : ""}{(((lastRate - firstRate) / firstRate) * 100).toFixed(2)}%)
        </span>
      </div>
    </div>
  );
}

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

function conditionLabel(order: FxOrder): string {
  const ct = order.conditionType || "rate_reaches";
  if (ct === "pct_change") {
    return `${order.pctChangeThreshold ?? 5}% move in ${order.pctChangeTimeframe ?? "24h"}`;
  }
  if (ct === "rate_crosses_above") return `crosses above ${order.targetRate}`;
  if (ct === "rate_crosses_below") return `crosses below ${order.targetRate}`;
  return `rate reaches ${order.targetRate}`;
}

export default function TradingPage() {
  const { address, isConnected } = useAccount();
  const [orders, setOrders] = useState<FxOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [fromToken, setFromToken] = useState("cUSD");
  const [toToken, setToToken] = useState("cEUR");
  const [amount, setAmount] = useState("");
  const [conditionType, setConditionType] = useState<AlertConditionType>("rate_reaches");
  const [targetRate, setTargetRate] = useState("");
  const [pctThreshold, setPctThreshold] = useState("5");
  const [pctTimeframe, setPctTimeframe] = useState<"1h" | "4h" | "24h">("24h");
  const [deadlineHours, setDeadlineHours] = useState(24);
  const [creating, setCreating] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Track executed order IDs for toast notifications
  const executedIdsRef = useRef<Set<string>>(new Set());

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      const json = await res.json();
      const fetched: FxOrder[] = json.orders || [];

      // Check for newly executed orders → toast
      for (const order of fetched) {
        if (order.status === "executed" && !executedIdsRef.current.has(order.id)) {
          executedIdsRef.current.add(order.id);
          // Only toast if this wasn't from initial load
          if (!loading) {
            toast.success(`Alert filled: ${order.amountIn} ${order.fromToken} → ${order.toToken}`, {
              description: `Rate: ${order.executedRate?.toFixed(4) ?? "—"} | ${order.executedTxHash ? "View on Celoscan" : ""}`,
              action: order.executedTxHash
                ? { label: "View", onClick: () => window.open(`https://celoscan.io/tx/${order.executedTxHash}`, "_blank") }
                : undefined,
              duration: 8000,
            });
          }
        }
      }
      // Seed initial executed IDs on first load
      if (loading) {
        for (const o of fetched) {
          if (o.status === "executed") executedIdsRef.current.add(o.id);
        }
      }

      setOrders(fetched);
      setCachedOrders(fetched);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10_000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const handleCreate = async () => {
    if (!address || !amount) return;
    if (conditionType === "rate_reaches" && !targetRate) return;
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
          targetRate: conditionType === "pct_change" ? 0 : targetRate,
          deadlineHours,
          conditionType,
          pctChangeThreshold: pctThreshold,
          pctChangeTimeframe: pctTimeframe,
        }),
      });
      if (res.ok) {
        setAmount("");
        setTargetRate("");
        setPctThreshold("5");
        await fetchOrders();
        toast("Alert created", { description: `Watching ${fromToken}/${toToken} — ${conditionType === "pct_change" ? `${pctThreshold}% move` : `rate ${targetRate}`}` });
      }
    } catch {
      toast.error("Failed to create alert");
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
      toast("Alert cancelled");
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

  // Aggregate rate history across all orders for the chart
  const allRateHistory = orders
    .flatMap((o) => (o.rateHistory || []).map((rh) => ({ ...rh, pair: `${o.fromToken}/${o.toToken}` })))
    .sort((a, b) => a.timestamp - b.timestamp);

  // Pick the most common pair's history for the chart
  const pairCounts = new Map<string, number>();
  allRateHistory.forEach((r) => pairCounts.set(r.pair, (pairCounts.get(r.pair) || 0) + 1));
  const topPair = [...pairCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const chartHistory = topPair
    ? allRateHistory.filter((r) => r.pair === topPair)
    : allRateHistory;

  // Find the target for the top pair
  const topPairOrder = pendingOrders.find((o) => `${o.fromToken}/${o.toToken}` === topPair);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 px-6 py-6 max-w-6xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-2xl font-display tracking-tight">
            Trading
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-lg">
            Set price alerts on Mento stablecoin rates. The agent monitors 24/7
            and auto-executes when your condition is met.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="border rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider">
              <Activity className="size-2.5" />
              Active
            </div>
            <p className="text-xl font-mono font-bold">{pendingOrders.length}</p>
          </div>
          <div className="border rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider">
              <CheckCircle2 className="size-2.5" />
              Filled
            </div>
            <p className="text-xl font-mono font-bold">{executedOrders.length}</p>
          </div>
          <div className="border rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider">
              <ArrowRight className="size-2.5" />
              Volume
            </div>
            <p className="text-xl font-mono font-bold">
              {totalVolume > 0 ? `$${totalVolume.toFixed(0)}` : "\u2014"}
            </p>
          </div>
        </div>

        {/* Rate Chart */}
        {chartHistory.length >= 2 && (
          <Card className="gap-0 py-0">
            <CardContent className="py-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {topPair || "Rate"} History
                  </span>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  {chartHistory.length} data points
                </span>
              </div>
              <RateChart
                history={chartHistory}
                target={topPairOrder?.targetRate}
              />
            </CardContent>
          </Card>
        )}

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
                  {/* Token pair */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        Swap from
                      </label>
                      <select
                        value={fromToken}
                        onChange={(e) => setFromToken(e.target.value)}
                        className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {TOKEN_OPTIONS.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        Receive
                      </label>
                      <select
                        value={toToken}
                        onChange={(e) => setToToken(e.target.value)}
                        className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {TOKEN_OPTIONS.filter((t) => t !== fromToken).map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Amount */}
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

                  {/* Condition type selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">
                      Alert condition
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {CONDITION_TYPES.map((ct) => (
                        <button
                          key={ct.value}
                          onClick={() => setConditionType(ct.value)}
                          className={`flex items-center gap-1.5 px-2.5 py-2 text-xs border rounded-lg transition-colors text-left ${
                            conditionType === ct.value
                              ? "bg-foreground text-background border-foreground"
                              : "hover:bg-accent"
                          }`}
                        >
                          {ct.value === "rate_reaches" && <Target className="size-3 shrink-0" />}
                          {ct.value === "pct_change" && <Percent className="size-3 shrink-0" />}
                          {ct.value === "rate_crosses_above" && <ArrowUpRight className="size-3 shrink-0" />}
                          {ct.value === "rate_crosses_below" && <ArrowDownRight className="size-3 shrink-0" />}
                          <span>{ct.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Condition-specific inputs */}
                  {conditionType === "pct_change" ? (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          Execute when rate moves by
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            placeholder="5"
                            value={pctThreshold}
                            onChange={(e) => setPctThreshold(e.target.value)}
                            className="w-20 px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                            min="0.1"
                            step="0.5"
                          />
                          <span className="text-sm text-muted-foreground">%</span>
                          <span className="text-xs text-muted-foreground">within</span>
                          <div className="flex gap-1">
                            {PCT_TIMEFRAMES.map((tf) => (
                              <button
                                key={tf.value}
                                onClick={() => setPctTimeframe(tf.value)}
                                className={`px-2.5 py-1.5 text-xs border rounded-lg transition-colors ${
                                  pctTimeframe === tf.value
                                    ? "bg-foreground text-background border-foreground"
                                    : "hover:bg-accent"
                                }`}
                              >
                                {tf.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        The agent will swap when {fromToken}/{toToken} moves {pctThreshold || "5"}% in either direction within {pctTimeframe}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        {conditionType === "rate_crosses_above"
                          ? `When rate goes above (${toToken} per ${fromToken})`
                          : conditionType === "rate_crosses_below"
                            ? `When rate drops below (${toToken} per ${fromToken})`
                            : `When rate reaches (${toToken} per ${fromToken})`}
                      </label>
                      <input
                        type="number"
                        placeholder={
                          toToken === "cEUR" ? "e.g. 0.845"
                            : toToken === "cREAL" ? "e.g. 5.25"
                              : "e.g. 1.00"
                        }
                        value={targetRate}
                        onChange={(e) => setTargetRate(e.target.value)}
                        className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                        min="0"
                        step="0.001"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        The agent auto-executes when the Mento rate {conditionType === "rate_crosses_below" ? "drops below" : "hits"} this target
                      </p>
                    </div>
                  )}

                  {/* Deadline */}
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
                      parseFloat(amount) <= 0 ||
                      (conditionType !== "pct_change" && (!targetRate || parseFloat(targetRate) <= 0))
                    }
                    className="w-full px-4 py-2.5 text-sm font-medium bg-foreground text-background rounded-lg hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="size-3 animate-spin" />
                        Setting alert...
                      </>
                    ) : (
                      <>
                        <Bell className="size-3.5" />
                        Set Alert
                      </>
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
                              Condition:{" "}
                              <span className="font-mono text-foreground">
                                {conditionLabel(order)}
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

        {/* All Alerts */}
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
                        className="py-2 px-2 rounded hover:bg-muted/50 transition-colors text-xs flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-muted-foreground">
                            {formatAddress(order.creator)}
                          </span>
                          <span className="font-mono font-medium">
                            {order.amountIn} {order.fromToken} → {order.toToken}
                          </span>
                          <span className="text-muted-foreground">
                            {conditionLabel(order)}
                          </span>
                          {order.status === "pending" && order.rateHistory && order.rateHistory.length >= 2 && (
                            <RateSparkline history={order.rateHistory} target={order.targetRate} />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {order.status === "pending" && (
                            <CountdownTimer deadline={order.deadline} />
                          )}
                          <Badge variant="outline" className={`text-[10px] ${cfg.color}`}>
                            {order.status}
                          </Badge>
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
