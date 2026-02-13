/**
 * Structured error codes for CeloFX API responses.
 * External agents can programmatically handle failures using the `code` field.
 */

export type ApiErrorCode =
  | "RATE_LIMITED"
  | "AGENT_PAUSED"
  | "VOLUME_LIMIT_EXCEEDED"
  | "SPREAD_TOO_LOW"
  | "SPREAD_NEGATIVE"
  | "ORDER_NOT_FOUND"
  | "ORDER_EXPIRED"
  | "ORDER_NOT_PENDING"
  | "RATE_BELOW_TARGET"
  | "INVALID_TOKEN"
  | "INVALID_ADDRESS"
  | "INVALID_AMOUNT"
  | "MISSING_FIELDS"
  | "MISSING_PRIVATE_KEY"
  | "NO_POOL_FOUND"
  | "QUOTE_FAILED"
  | "SWAP_FAILED"
  | "TRANSFER_FAILED"
  | "ARB_SPREAD_TOO_LOW"
  | "NOT_FOUND"
  | "INTERNAL_ERROR";

export interface ApiError {
  error: string;
  code: ApiErrorCode;
  details?: Record<string, unknown>;
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  details?: Record<string, unknown>
): ApiError {
  return { error: message, code, details };
}
