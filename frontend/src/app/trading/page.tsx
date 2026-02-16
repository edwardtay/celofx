"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatAddress, formatTimeAgo } from "@/lib/format";
import { useAccount, useSignMessage } from "wagmi";
import { toast } from "sonner";
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  XCircle,
  ChevronDown,
} from "lucide-react";
import type { FxOrder } from "@/lib/types";
import { setCachedOrders } from "@/lib/local-cache";

const TOKEN_OPTIONS = ["cUSD", "cEUR", "cREAL", "USDC", "USDT"];
const DEADLINE_OPTIONS = [
  { label: "12h", hours: 12 },
  { label: "24h", hours: 24 },
  { label: "48h", hours: 48 },
  { label: "7d", hours: 168 },
];

function CountdownTimer({ deadline }: { deadline: number }) {
  const [now, setNow] = useState(deadline);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const remaining = deadline - now;
  if (remaining <= 0) return <span className="font-mono text-xs text-red-600">Expired</span>;

  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  return <span className="font-mono text-xs text-muted-foreground">{hours}h {minutes}m</span>;
}

const statusConfig = {
  pending: { color: "bg-blue-50 text-blue-700 border-blue-200", icon: Clock },
  executed: { color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  expired: { color: "bg-muted text-muted-foreground", icon: XCircle },
  cancelled: { color: "bg-muted text-muted-foreground", icon: XCircle },
};

export default function TradingPage() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [orders, setOrders] = useState<FxOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const [fromToken, setFromToken] = useState("cUSD");
  const [toToken, setToToken] = useState("cEUR");
  const [amount, setAmount] = useState("100");
  const [targetRate, setTargetRate] = useState("");
  const [deadlineHours, setDeadlineHours] = useState(24);
  const [creating, setCreating] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const executedIdsRef = useRef<Set<string>>(new Set());

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      const json = await res.json();
      const fetched: FxOrder[] = json.orders || [];

      for (const order of fetched) {
        if (order.status === "executed" && !executedIdsRef.current.has(order.id)) {
          executedIdsRef.current.add(order.id);
          if (!loading) {
            toast.success(`Alert filled: ${order.amountIn} ${order.fromToken} → ${order.toToken}`, {
              description: `Rate: ${order.executedRate?.toFixed(4) ?? "—"}`,
              action: order.executedTxHash
                ? { label: "View", onClick: () => window.open(`https://celoscan.io/tx/${order.executedTxHash}`, "_blank") }
                : undefined,
              duration: 8000,
            });
          }
        }
      }

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
    if (!address || !amount || !targetRate) return;
    setCreating(true);

    try {
      const timestamp = Date.now();
      const nonce = crypto.randomUUID();
      const message = [
        "CeloFX Order Create",
        `creator:${address.toLowerCase()}`,
        `from:${fromToken}`,
        `to:${toToken}`,
        `amount:${amount}`,
        `target:${targetRate}`,
        `deadlineHours:${deadlineHours}`,
        "condition:rate_reaches",
        `nonce:${nonce}`,
        `timestamp:${timestamp}`,
      ].join("\n");

      const signature = await signMessageAsync({ message });

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
          conditionType: "rate_reaches",
          signature,
          nonce,
          timestamp,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = json?.error?.message || json?.error || "Failed to create alert";
        const extra = json?.error?.details?.nonce ? ` (${json.error.details.nonce})` : "";
        toast.error(`${errMsg}${extra}`);
        return;
      }
      if (json?.idempotent) {
        toast("Alert already created", {
          description: "Duplicate submit detected. Existing alert kept.",
        });
        await fetchOrders();
        return;
      }

      await fetchOrders();
      toast("Alert created", {
        description: `Watching ${fromToken}/${toToken} until ${targetRate}`,
      });
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
      const timestamp = Date.now();
      const nonce = crypto.randomUUID();
      const message = [
        "CeloFX Order Cancel",
        `orderId:${orderId}`,
        `creator:${address.toLowerCase()}`,
        `nonce:${nonce}`,
        `timestamp:${timestamp}`,
      ].join("\n");

      const signature = await signMessageAsync({ message });

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
          orderId,
          creator: address,
          signature,
          nonce,
          timestamp,
        }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error(json?.error?.message || json?.error || "Failed to cancel alert");
        return;
      }

      await fetchOrders();
      toast(json?.idempotent ? "Alert already cancelled" : "Alert cancelled");
    } catch {
      toast.error("Failed to cancel alert");
    } finally {
      setCancellingId(null);
    }
  };

  const myOrders = address
    ? orders.filter((o) => o.creator.toLowerCase() === address.toLowerCase())
    : [];

  const myPending = myOrders.filter((o) => o.status === "pending");

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-5 sm:px-6">
        <div>
          <h1 className="text-2xl font-display tracking-tight">Trading</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Set a target rate. The agent watches and executes when your rate is reached.
          </p>
        </div>

        <Card className="gap-0 py-0">
          <CardContent className="space-y-4 py-4">
            <div className="flex items-center gap-2">
              <Bell className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">Create alert</span>
            </div>

            {!isConnected ? (
              <p className="text-sm text-muted-foreground">Connect wallet to create trading alerts.</p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Swap from</label>
                    <select
                      value={fromToken}
                      onChange={(e) => setFromToken(e.target.value)}
                      className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      {TOKEN_OPTIONS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Receive</label>
                    <select
                      value={toToken}
                      onChange={(e) => setToToken(e.target.value)}
                      className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      {TOKEN_OPTIONS.filter((t) => t !== fromToken).map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Amount ({fromToken})</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-muted-foreground">Target rate ({toToken} per {fromToken})</label>
                    <input
                      type="number"
                      min="0"
                      step="0.0001"
                      value={targetRate}
                      onChange={(e) => setTargetRate(e.target.value)}
                      placeholder="0.8450"
                      className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Keep watching for</label>
                  <div className="grid grid-cols-4 gap-2">
                    {DEADLINE_OPTIONS.map((opt) => (
                      <button
                        key={opt.hours}
                        onClick={() => setDeadlineHours(opt.hours)}
                        className={`rounded-lg border px-2 py-2 text-xs ${
                          deadlineHours === opt.hours
                            ? "border-foreground bg-foreground text-background"
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
                  disabled={creating || !amount || Number(amount) <= 0 || !targetRate || Number(targetRate) <= 0}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 py-3 text-sm font-medium text-background hover:bg-foreground/90 disabled:opacity-50"
                >
                  {creating ? <Loader2 className="size-4 animate-spin" /> : <Bell className="size-4" />}
                  {creating ? "Creating alert..." : "Create alert"}
                </button>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="gap-0 py-0">
          <CardContent className="space-y-3 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">Your alerts</span>
              </div>
              {myPending.length > 0 && (
                <Badge variant="outline" className="text-[10px]">{myPending.length} active</Badge>
              )}
            </div>

            {!isConnected ? (
              <p className="py-3 text-sm text-muted-foreground">Connect wallet to view your alerts.</p>
            ) : myOrders.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">No alerts yet.</p>
            ) : (
              <div className="space-y-2">
                {myOrders.map((order) => {
                  const cfg = statusConfig[order.status];
                  const StatusIcon = cfg.icon;
                  return (
                    <div key={order.id} className="space-y-2 rounded-lg border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-mono">
                          {order.amountIn} {order.fromToken} <ArrowRight className="mx-1 inline size-3" /> {order.toToken}
                        </div>
                        <Badge variant="outline" className={`text-[10px] ${cfg.color}`}>
                          <StatusIcon className="mr-1 size-2.5" />
                          {order.status}
                        </Badge>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        Target: <span className="font-mono text-foreground">{order.targetRate}</span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{formatTimeAgo(order.createdAt)}</span>
                        {order.status === "pending" ? <CountdownTimer deadline={order.deadline} /> : <span />}
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        {order.executedTxHash && (
                          <a
                            href={`https://celoscan.io/tx/${order.executedTxHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded border px-2 py-1 text-[10px] hover:bg-accent"
                          >
                            <span className="inline-flex items-center gap-1">Tx <ExternalLink className="size-3" /></span>
                          </a>
                        )}
                        {order.status === "pending" && (
                          <button
                            onClick={() => handleCancel(order.id)}
                            disabled={cancellingId === order.id}
                            className="rounded border px-2 py-1 text-[10px] hover:bg-accent disabled:opacity-50"
                          >
                            {cancellingId === order.id ? <Loader2 className="size-3 animate-spin" /> : "Cancel"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <details className="rounded-lg border bg-card">
          <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium">
            Market activity
            <ChevronDown className="size-4 text-muted-foreground" />
          </summary>
          <div className="space-y-1 px-2 pb-2">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : orders.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              orders.map((order) => {
                const cfg = statusConfig[order.status];
                return (
                  <div key={order.id} className="flex items-center justify-between rounded px-2 py-2 text-xs hover:bg-muted/40">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <span className="truncate font-mono text-muted-foreground">{formatAddress(order.creator)}</span>
                      <span className="truncate font-mono">{order.amountIn} {order.fromToken} → {order.toToken}</span>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${cfg.color}`}>{order.status}</Badge>
                  </div>
                );
              })
            )}
          </div>
        </details>
      </main>
      <Footer />
    </div>
  );
}
