export function formatCurrency(value: number | undefined | null, decimals = 2): string {
  if (value == null || isNaN(value)) return "$0.00";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  if (value >= 1) return `$${value.toFixed(decimals)}`;
  return `$${value.toFixed(4)}`;
}

/** Compact format for market overview cards: $97.5K, $2.8K */
export function formatCurrencyCompact(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return "$0.00";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(4)}`;
}

export function formatPercent(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return "0.00%";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/** Base URL for the app — portable across Vercel, Phala CVM, local dev */
export function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || "https://celofx.vercel.app";
}
