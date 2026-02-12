// Remittance data store — localStorage-backed persistence

const HISTORY_KEY = "celofx-remittance-history";
const RECURRING_KEY = "celofx-remittance-recurring";
const LIMITS_KEY = "celofx-remittance-limits";
const MAX_HISTORY = 50;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

// --- Remittance Transaction History ---

export interface RemittanceTransaction {
  id: string;
  timestamp: number;
  message: string; // original NL input
  corridor: string;
  fromToken: string;
  toToken: string;
  amount: number;
  amountOut: string;
  rate: number;
  recipientCountry: string | null;
  language: string;
  txHash: string | null;
  approvalHash: string | null;
  status: "quoted" | "executed" | "failed";
  fee: string;
  savingsVs: string;
  savingsAmount: string;
}

export function getRemittanceHistory(): RemittanceTransaction[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RemittanceTransaction[];
  } catch {
    return [];
  }
}

export function addRemittanceTransaction(tx: RemittanceTransaction): void {
  if (!isBrowser()) return;
  try {
    const existing = getRemittanceHistory();
    const updated = [tx, ...existing].slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // localStorage full
  }
}

export function updateRemittanceTransaction(
  id: string,
  update: Partial<RemittanceTransaction>
): void {
  if (!isBrowser()) return;
  try {
    const existing = getRemittanceHistory();
    const idx = existing.findIndex((t) => t.id === id);
    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...update };
      localStorage.setItem(HISTORY_KEY, JSON.stringify(existing));
    }
  } catch {
    // ignore
  }
}

// --- Recurring Transfers ---

export interface RecurringTransfer {
  id: string;
  message: string;
  corridor: string;
  fromToken: string;
  toToken: string;
  amount: number;
  recipientCountry: string | null;
  frequency: "weekly" | "biweekly" | "monthly";
  nextExecution: number; // timestamp
  createdAt: number;
  active: boolean;
  executionCount: number;
  notifyPhone: string | null;
  notifyMethod: "sms" | "whatsapp" | "none";
}

export function getRecurringTransfers(): RecurringTransfer[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(RECURRING_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecurringTransfer[];
  } catch {
    return [];
  }
}

export function addRecurringTransfer(transfer: RecurringTransfer): void {
  if (!isBrowser()) return;
  try {
    const existing = getRecurringTransfers();
    localStorage.setItem(
      RECURRING_KEY,
      JSON.stringify([transfer, ...existing])
    );
  } catch {
    // ignore
  }
}

export function updateRecurringTransfer(
  id: string,
  update: Partial<RecurringTransfer>
): void {
  if (!isBrowser()) return;
  try {
    const existing = getRecurringTransfers();
    const idx = existing.findIndex((t) => t.id === id);
    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...update };
      localStorage.setItem(RECURRING_KEY, JSON.stringify(existing));
    }
  } catch {
    // ignore
  }
}

export function removeRecurringTransfer(id: string): void {
  if (!isBrowser()) return;
  try {
    const existing = getRecurringTransfers().filter((t) => t.id !== id);
    localStorage.setItem(RECURRING_KEY, JSON.stringify(existing));
  } catch {
    // ignore
  }
}

// --- Spending Limits ---

export interface SpendingLimits {
  dailyLimit: number; // USD
  weeklyLimit: number;
  monthlyLimit: number;
}

const DEFAULT_LIMITS: SpendingLimits = {
  dailyLimit: 500,
  weeklyLimit: 2000,
  monthlyLimit: 5000,
};

export function getSpendingLimits(): SpendingLimits {
  if (!isBrowser()) return DEFAULT_LIMITS;
  try {
    const raw = localStorage.getItem(LIMITS_KEY);
    if (!raw) return DEFAULT_LIMITS;
    return JSON.parse(raw) as SpendingLimits;
  } catch {
    return DEFAULT_LIMITS;
  }
}

export function setSpendingLimits(limits: SpendingLimits): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(LIMITS_KEY, JSON.stringify(limits));
  } catch {
    // ignore
  }
}

// Calculate usage from history for a given time window
export function getUsage(windowMs: number): number {
  const history = getRemittanceHistory();
  const cutoff = Date.now() - windowMs;
  return history
    .filter((tx) => tx.status === "executed" && tx.timestamp >= cutoff)
    .reduce((sum, tx) => sum + tx.amount, 0);
}

export function getDailyUsage(): number {
  return getUsage(24 * 60 * 60 * 1000);
}

export function getWeeklyUsage(): number {
  return getUsage(7 * 24 * 60 * 60 * 1000);
}

export function getMonthlyUsage(): number {
  return getUsage(30 * 24 * 60 * 60 * 1000);
}

export function checkSpendingLimit(amount: number): {
  allowed: boolean;
  reason: string | null;
} {
  const limits = getSpendingLimits();
  const daily = getDailyUsage();
  const weekly = getWeeklyUsage();
  const monthly = getMonthlyUsage();

  if (daily + amount > limits.dailyLimit) {
    return {
      allowed: false,
      reason: `Daily limit exceeded: $${daily.toFixed(0)} + $${amount} > $${limits.dailyLimit} daily limit`,
    };
  }
  if (weekly + amount > limits.weeklyLimit) {
    return {
      allowed: false,
      reason: `Weekly limit exceeded: $${weekly.toFixed(0)} + $${amount} > $${limits.weeklyLimit} weekly limit`,
    };
  }
  if (monthly + amount > limits.monthlyLimit) {
    return {
      allowed: false,
      reason: `Monthly limit exceeded: $${monthly.toFixed(0)} + $${amount} > $${limits.monthlyLimit} monthly limit`,
    };
  }
  return { allowed: true, reason: null };
}
