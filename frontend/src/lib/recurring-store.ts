export interface RecurringTransfer {
  id: string;
  fromToken: string;
  toToken: string;
  amount: string;
  recipientAddress: string;
  corridor: string; // e.g. "US→MX", "EU→PH"
  frequency: "daily" | "weekly" | "biweekly" | "monthly";
  nextExecution: number; // timestamp
  active: boolean;
  executionCount: number;
  lastTxHash?: string;
  createdAt: number;
}

const recurring = new Map<string, RecurringTransfer>();

export function addRecurring(transfer: RecurringTransfer): void {
  recurring.set(transfer.id, transfer);
}

export function getRecurring(filter?: {
  active?: boolean;
  dueNow?: boolean;
}): RecurringTransfer[] {
  let result = Array.from(recurring.values());

  if (filter?.active !== undefined) {
    result = result.filter((r) => r.active === filter.active);
  }

  if (filter?.dueNow) {
    const now = Date.now();
    result = result.filter((r) => r.nextExecution <= now);
  }

  return result.sort((a, b) => a.nextExecution - b.nextExecution);
}

export function getRecurringById(id: string): RecurringTransfer | undefined {
  return recurring.get(id);
}

export function updateRecurring(
  id: string,
  update: Partial<RecurringTransfer>
): void {
  const existing = recurring.get(id);
  if (existing) {
    recurring.set(id, { ...existing, ...update });
  }
}

export function advanceNextExecution(id: string): void {
  const transfer = recurring.get(id);
  if (!transfer) return;

  const intervals: Record<string, number> = {
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
    biweekly: 14 * 24 * 60 * 60 * 1000,
    monthly: 30 * 24 * 60 * 60 * 1000,
  };

  recurring.set(id, {
    ...transfer,
    nextExecution: Date.now() + (intervals[transfer.frequency] || intervals.weekly),
    executionCount: transfer.executionCount + 1,
  });
}

export function deleteRecurring(id: string): boolean {
  return recurring.delete(id);
}
