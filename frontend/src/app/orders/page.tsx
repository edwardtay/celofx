"use client";

import { useState, useEffect, useCallback } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatAddress, formatTimeAgo } from "@/lib/format";
import { useAccount } from "wagmi";
import {
  ListOrdered,
  Clock,
  CheckCircle2,
  XCircle,
  Target,
  ArrowRight,
  Loader2,
  ExternalLink,
  Plus,
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

export default function OrdersPage() {
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
          <h1 className="text-2xl font-display tracking-tight">
            Smart FX Orders
          </h1>
          <Badge variant="outline" className="text-xs font-mono">
            {pendingOrders.length} active
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground max-w-lg -mt-4">
          Set a target rate and deadline. The autonomous agent evaluates your
          orders every scan cycle and decides when to execute based on forex
          trends and Mento rates.
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="border rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider">
              <ListOrdered className="size-2.5" />
              Active Orders
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
              {avgFillRate > 0 ? avgFillRate.toFixed(4) : "—"}
            </p>
          </div>
          <div className="border rounded-lg p-3 space-y-1">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider">
              <ArrowRight className="size-2.5" />
              Total Volume
            </div>
            <p className="text-xl font-mono font-bold">
              {totalVolume > 0 ? `$${totalVolume.toFixed(0)}` : "—"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Create Order Form */}
          <Card className="gap-0 py-0">
            <CardContent className="py-4 space-y-4">
              <div className="flex items-center gap-2">
                <Plus className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">Create Order</span>
              </div>

              {!isConnected ? (
                <p className="text-sm text-muted-foreground py-4">
                  Connect your wallet to create smart FX orders.
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        From
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
                        To
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
                      Target Rate ({toToken} per {fromToken})
                    </label>
                    <input
                      type="number"
                      placeholder={
                        toToken === "cEUR"
                          ? "0.845"
                          : toToken === "cREAL"
                            ? "5.25"
                            : "1.00"
                      }
                      value={targetRate}
                      onChange={(e) => setTargetRate(e.target.value)}
                      className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                      min="0"
                      step="0.001"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Agent will execute when Mento rate reaches this level
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">
                      Deadline
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
                        Creating...
                      </>
                    ) : (
                      "Create Order"
                    )}
                  </button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Your Active Orders */}
          <Card className="gap-0 py-0">
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">Your Orders</span>
                {myPending.length > 0 && (
                  <Badge variant="outline" className="text-[10px]">
                    {myPending.length} active
                  </Badge>
                )}
              </div>

              {!isConnected ? (
                <p className="text-sm text-muted-foreground py-4">
                  Connect your wallet to view your orders.
                </p>
              ) : myOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  No orders yet. Create your first smart FX order.
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

                        {order.agentReasoning && (
                          <p className="text-[11px] text-muted-foreground border-t pt-2 leading-relaxed">
                            {order.agentReasoning}
                          </p>
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

        {/* All Orders Table */}
        {orders.length > 0 && (
          <Card className="gap-0 py-0">
            <CardContent className="py-4 space-y-3">
              <div className="flex items-center gap-2">
                <ListOrdered className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">All Orders</span>
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
                        className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 transition-colors text-xs"
                      >
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
