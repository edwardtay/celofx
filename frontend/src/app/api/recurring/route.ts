import { NextRequest, NextResponse } from "next/server";
import {
  addRecurring,
  getRecurring,
  getRecurringById,
  updateRecurring,
  deleteRecurring,
  type RecurringTransfer,
} from "@/lib/recurring-store";
import { hasAgentSecret, requireSignedAuth, unauthorizedResponse, missingSecretResponse } from "@/lib/auth";

export async function GET() {
  const active = getRecurring({ active: true });
  const all = getRecurring();

  return NextResponse.json({
    recurring: all,
    activeCount: active.length,
    totalCount: all.length,
  });
}

export async function POST(request: NextRequest) {
  if (!hasAgentSecret()) {
    return missingSecretResponse();
  }

  const auth = await requireSignedAuth(request);
  if (!auth.ok) {
    return unauthorizedResponse();
  }

  const body = await request.json();
  const { action } = body;

  if (action === "create") {
    const { fromToken, toToken, amount, recipientAddress, corridor, frequency } = body;

    if (!fromToken || !toToken || !amount || !recipientAddress || !corridor || !frequency) {
      return NextResponse.json(
        { error: "Missing required fields: fromToken, toToken, amount, recipientAddress, corridor, frequency" },
        { status: 400 }
      );
    }

    const validFrequencies = ["daily", "weekly", "biweekly", "monthly"];
    if (!validFrequencies.includes(frequency)) {
      return NextResponse.json(
        { error: `Invalid frequency. Use: ${validFrequencies.join(", ")}` },
        { status: 400 }
      );
    }

    const intervals: Record<string, number> = {
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000,
      biweekly: 14 * 24 * 60 * 60 * 1000,
      monthly: 30 * 24 * 60 * 60 * 1000,
    };

    const now = Date.now();
    const transfer: RecurringTransfer = {
      id: `recurring-${now}-${Math.random().toString(36).slice(2, 8)}`,
      fromToken,
      toToken,
      amount: String(parseFloat(amount)),
      recipientAddress,
      corridor,
      frequency,
      nextExecution: now + intervals[frequency],
      active: true,
      executionCount: 0,
      createdAt: now,
    };

    addRecurring(transfer);
    return NextResponse.json({ transfer }, { status: 201 });
  }

  if (action === "pause" || action === "resume") {
    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const existing = getRecurringById(id);
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    updateRecurring(id, { active: action === "resume" });
    return NextResponse.json({ transfer: { ...existing, active: action === "resume" } });
  }

  if (action === "delete") {
    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const deleted = deleteRecurring(id);
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ deleted: true, id });
  }

  return NextResponse.json(
    { error: "Invalid action. Use 'create', 'pause', 'resume', or 'delete'" },
    { status: 400 }
  );
}
