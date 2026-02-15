"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Repeat,
  Plus,
  Pause,
  Play,
  Trash2,
  Phone,
  MessageCircle,
  Calendar,
  MapPin,
} from "lucide-react";
import {
  getRecurringTransfers,
  addRecurringTransfer,
  updateRecurringTransfer,
  removeRecurringTransfer,
  type RecurringTransfer,
} from "@/lib/remittance-store";

function nextDate(freq: RecurringTransfer["frequency"]): number {
  const now = Date.now();
  switch (freq) {
    case "weekly":
      return now + 7 * 24 * 60 * 60 * 1000;
    case "biweekly":
      return now + 14 * 24 * 60 * 60 * 1000;
    case "monthly":
      return now + 30 * 24 * 60 * 60 * 1000;
  }
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

interface Props {
  pendingTransfer?: {
    message: string;
    corridor: string;
    fromToken: string;
    toToken: string;
    amount: number;
    recipientCountry: string | null;
  } | null;
  refreshKey: number;
}

export function RecurringTransfers({ pendingTransfer, refreshKey }: Props) {
  const [transfers, setTransfers] = useState<RecurringTransfer[]>([]);
  const [showSetup, setShowSetup] = useState(false);
  const [frequency, setFrequency] = useState<RecurringTransfer["frequency"]>("monthly");
  const [phone, setPhone] = useState("");
  const [notifyMethod, setNotifyMethod] = useState<"sms" | "whatsapp" | "none">("none");

  useEffect(() => {
    const t = setTimeout(() => setTransfers(getRecurringTransfers()), 0);
    return () => clearTimeout(t);
  }, [refreshKey]);

  const handleCreate = () => {
    if (!pendingTransfer) return;

    const transfer: RecurringTransfer = {
      id: `rec-${Date.now()}`,
      message: pendingTransfer.message,
      corridor: pendingTransfer.corridor,
      fromToken: pendingTransfer.fromToken,
      toToken: pendingTransfer.toToken,
      amount: pendingTransfer.amount,
      recipientCountry: pendingTransfer.recipientCountry,
      frequency,
      nextExecution: nextDate(frequency),
      createdAt: Date.now(),
      active: true,
      executionCount: 0,
      notifyPhone: phone.trim() || null,
      notifyMethod: phone.trim() ? notifyMethod : "none",
    };

    addRecurringTransfer(transfer);
    setTransfers(getRecurringTransfers());
    setShowSetup(false);
    setPhone("");
    setNotifyMethod("none");
  };

  const handleToggle = (id: string, active: boolean) => {
    updateRecurringTransfer(id, { active: !active });
    setTransfers(getRecurringTransfers());
  };

  const handleRemove = (id: string) => {
    removeRecurringTransfer(id);
    setTransfers(getRecurringTransfers());
  };

  return (
    <Card className="gap-0 py-0">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Repeat className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Recurring Transfers</span>
            {transfers.filter((t) => t.active).length > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] bg-blue-50 text-blue-700 border-blue-200"
              >
                {transfers.filter((t) => t.active).length} active
              </Badge>
            )}
          </div>
          {pendingTransfer && !showSetup && (
            <button
              onClick={() => setShowSetup(true)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors"
            >
              <Plus className="size-3" />
              Schedule this transfer
            </button>
          )}
        </div>

        {/* Setup form */}
        {showSetup && pendingTransfer && (
          <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
            <div className="text-xs text-muted-foreground">
              Schedule{" "}
              <span className="font-mono font-medium text-foreground">
                {pendingTransfer.amount} {pendingTransfer.fromToken}
              </span>{" "}
              to{" "}
              <span className="font-medium text-foreground">
                {pendingTransfer.recipientCountry || pendingTransfer.corridor}
              </span>
            </div>

            {/* Frequency */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                Frequency
              </label>
              <div className="flex gap-2">
                {(["weekly", "biweekly", "monthly"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFrequency(f)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      frequency === f
                        ? "bg-foreground text-background border-foreground"
                        : "hover:bg-accent"
                    }`}
                  >
                    {f === "biweekly" ? "Bi-weekly" : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Notifications */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                Notify recipient
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setNotifyMethod("none")}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    notifyMethod === "none"
                      ? "bg-foreground text-background border-foreground"
                      : "hover:bg-accent"
                  }`}
                >
                  None
                </button>
                <button
                  onClick={() => setNotifyMethod("sms")}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors flex items-center gap-1 ${
                    notifyMethod === "sms"
                      ? "bg-foreground text-background border-foreground"
                      : "hover:bg-accent"
                  }`}
                >
                  <Phone className="size-3" />
                  SMS
                </button>
                <button
                  onClick={() => setNotifyMethod("whatsapp")}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors flex items-center gap-1 ${
                    notifyMethod === "whatsapp"
                      ? "bg-foreground text-background border-foreground"
                      : "hover:bg-accent"
                  }`}
                >
                  <MessageCircle className="size-3" />
                  WhatsApp
                </button>
              </div>
              {notifyMethod !== "none" && (
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 234 567 8900"
                  className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                />
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCreate}
                className="px-4 py-2 text-xs font-medium bg-foreground text-background rounded-lg hover:bg-foreground/90 transition-colors"
              >
                Schedule {frequency} transfer
              </button>
              <button
                onClick={() => setShowSetup(false)}
                className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Existing recurring transfers */}
        {transfers.length > 0 ? (
          <div className="space-y-1">
            {transfers.map((t) => (
              <div
                key={t.id}
                className={`flex items-center justify-between py-2 px-2.5 rounded ${
                  t.active ? "hover:bg-muted/50" : "opacity-50"
                } transition-colors`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Repeat
                    className={`size-3.5 shrink-0 ${
                      t.active ? "text-blue-500" : "text-muted-foreground"
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="font-mono font-medium">
                        {t.amount} {t.fromToken}
                      </span>
                      <span className="text-muted-foreground text-xs">→</span>
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1.5 py-0"
                      >
                        {t.corridor}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <Calendar className="size-2" />
                      <span className="capitalize">{t.frequency}</span>
                      <span>·</span>
                      <span>Next: {formatDate(t.nextExecution)}</span>
                      {t.recipientCountry && (
                        <>
                          <span>·</span>
                          <MapPin className="size-2" />
                          <span>{t.recipientCountry}</span>
                        </>
                      )}
                      {t.notifyMethod !== "none" && t.notifyPhone && (
                        <>
                          <span>·</span>
                          {t.notifyMethod === "whatsapp" ? (
                            <MessageCircle className="size-2" />
                          ) : (
                            <Phone className="size-2" />
                          )}
                          <span>{t.notifyPhone}</span>
                        </>
                      )}
                      {t.executionCount > 0 && (
                        <>
                          <span>·</span>
                          <span>{t.executionCount} sent</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleToggle(t.id, t.active)}
                    className="p-1.5 rounded hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                    title={t.active ? "Pause" : "Resume"}
                  >
                    {t.active ? (
                      <Pause className="size-3" />
                    ) : (
                      <Play className="size-3" />
                    )}
                  </button>
                  <button
                    onClick={() => handleRemove(t.id)}
                    className="p-1.5 rounded hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600"
                    title="Remove"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : !showSetup ? (
          <p className="text-xs text-muted-foreground">
            No recurring transfers. Make a transfer first, then schedule it to repeat.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
