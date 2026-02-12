"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Settings, Check } from "lucide-react";
import {
  getSpendingLimits,
  setSpendingLimits,
  getDailyUsage,
  getWeeklyUsage,
  getMonthlyUsage,
  type SpendingLimits as SpendingLimitsType,
} from "@/lib/remittance-store";

interface Props {
  refreshKey: number;
}

function UsageBar({
  label,
  usage,
  limit,
}: {
  label: string;
  usage: number;
  limit: number;
}) {
  const pct = limit > 0 ? Math.min((usage / limit) * 100, 100) : 0;
  const isNear = pct > 75;
  const isOver = pct >= 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground uppercase tracking-wider font-medium">
          {label}
        </span>
        <span
          className={`font-mono ${
            isOver
              ? "text-red-600 font-medium"
              : isNear
                ? "text-amber-600"
                : "text-muted-foreground"
          }`}
        >
          ${usage.toFixed(0)} / ${limit.toFixed(0)}
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isOver
              ? "bg-red-500"
              : isNear
                ? "bg-amber-500"
                : "bg-emerald-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function SpendingLimitsCard({ refreshKey }: Props) {
  const [limits, setLimits] = useState<SpendingLimitsType>({
    dailyLimit: 500,
    weeklyLimit: 2000,
    monthlyLimit: 5000,
  });
  const [daily, setDaily] = useState(0);
  const [weekly, setWeekly] = useState(0);
  const [monthly, setMonthly] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(limits);

  useEffect(() => {
    setLimits(getSpendingLimits());
    setDaily(getDailyUsage());
    setWeekly(getWeeklyUsage());
    setMonthly(getMonthlyUsage());
  }, [refreshKey]);

  const handleSave = () => {
    setSpendingLimits(draft);
    setLimits(draft);
    setEditing(false);
  };

  return (
    <Card className="gap-0 py-0">
      <CardContent className="py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">Spending Limits</span>
            <Badge
              variant="outline"
              className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200"
            >
              Security
            </Badge>
          </div>
          <button
            onClick={() => {
              if (editing) {
                handleSave();
              } else {
                setDraft(limits);
                setEditing(true);
              }
            }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {editing ? (
              <>
                <Check className="size-3" />
                Save
              </>
            ) : (
              <>
                <Settings className="size-3" />
                Edit
              </>
            )}
          </button>
        </div>

        {editing ? (
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                ["Daily", "dailyLimit"],
                ["Weekly", "weeklyLimit"],
                ["Monthly", "monthlyLimit"],
              ] as const
            ).map(([label, key]) => (
              <div key={key} className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                  {label}
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">$</span>
                  <input
                    type="number"
                    value={draft[key]}
                    onChange={(e) =>
                      setDraft({ ...draft, [key]: Number(e.target.value) })
                    }
                    className="w-full px-2 py-1.5 text-sm font-mono border rounded bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2.5">
            <UsageBar label="Daily" usage={daily} limit={limits.dailyLimit} />
            <UsageBar
              label="Weekly"
              usage={weekly}
              limit={limits.weeklyLimit}
            />
            <UsageBar
              label="Monthly"
              usage={monthly}
              limit={limits.monthlyLimit}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
