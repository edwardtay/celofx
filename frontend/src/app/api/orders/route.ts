import { NextRequest, NextResponse } from "next/server";
import {
  getOrders,
  addOrder,
  getOrder,
  updateOrder,
} from "@/lib/order-store";
import type { FxOrder, OrderStatus } from "@/lib/types";
import { apiError } from "@/lib/api-errors";
import { isAddress, recoverMessageAddress } from "viem";

const VALID_TOKENS = ["cUSD", "cEUR", "cREAL", "USDC", "USDT"];
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") as OrderStatus | null;
  const creator = searchParams.get("creator");

  const orders = getOrders({
    status: status || undefined,
    creator: creator || undefined,
  });

  return NextResponse.json({ orders, count: orders.length });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action } = body;

  if (action === "create") {
    const { creator, fromToken, toToken, amountIn, targetRate, deadlineHours, conditionType, pctChangeThreshold, pctChangeTimeframe, signature, timestamp } =
      body;

    const cType = conditionType || "rate_reaches";

    if (!creator || !fromToken || !toToken || !amountIn) {
      return NextResponse.json(
        apiError("MISSING_FIELDS", "Missing required fields: creator, fromToken, toToken, amountIn"),
        { status: 400 }
      );
    }
    if (!isAddress(creator)) {
      return NextResponse.json(
        apiError("INVALID_CREATOR", "Creator must be a valid address", { creator }),
        { status: 400 }
      );
    }
    if (!signature || !timestamp) {
      return NextResponse.json(
        apiError("MISSING_FIELDS", "Missing signature or timestamp", { signature, timestamp }),
        { status: 400 }
      );
    }
    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > MAX_CLOCK_SKEW_MS) {
      return NextResponse.json(
        apiError("INVALID_TIMESTAMP", "Timestamp is invalid or too old", { timestamp }),
        { status: 400 }
      );
    }

    // For pct_change conditions, targetRate is optional (computed from current rate + threshold)
    if (cType === "rate_reaches" && !targetRate) {
      return NextResponse.json(
        apiError("MISSING_FIELDS", "Target rate required for rate-based alerts"),
        { status: 400 }
      );
    }

    if (!VALID_TOKENS.includes(fromToken) || !VALID_TOKENS.includes(toToken)) {
      return NextResponse.json(
        apiError("INVALID_TOKEN", `Invalid token. Use: ${VALID_TOKENS.join(", ")}`, { fromToken, toToken }),
        { status: 400 }
      );
    }

    if (fromToken === toToken) {
      return NextResponse.json(
        apiError("INVALID_TOKEN", "From and to tokens must be different"),
        { status: 400 }
      );
    }

    const amount = parseFloat(amountIn);
    if (isNaN(amount) || amount <= 0 || amount > 100) {
      return NextResponse.json(
        apiError("INVALID_AMOUNT", "Amount must be between 0 and 100", { amountIn }),
        { status: 400 }
      );
    }

    const rate = parseFloat(targetRate);
    const requiresTargetRate = cType === "rate_reaches" || cType === "rate_crosses_above" || cType === "rate_crosses_below";
    if (requiresTargetRate && (isNaN(rate) || rate <= 0)) {
      return NextResponse.json(
        apiError("INVALID_AMOUNT", "Target rate must be a positive number", { targetRate }),
        { status: 400 }
      );
    }

    const hours = parseFloat(deadlineHours) || 24;
    const now = Date.now();

    // Verify creator signature for order creation
    const message = [
      "CeloFX Order Create",
      `creator:${creator.toLowerCase()}`,
      `from:${fromToken}`,
      `to:${toToken}`,
      `amount:${amountIn}`,
      `target:${targetRate}`,
      `deadlineHours:${hours}`,
      `condition:${cType}`,
      `timestamp:${ts}`,
    ].join("\n");
    try {
      const recovered = await recoverMessageAddress({ message, signature });
      if (recovered.toLowerCase() !== creator.toLowerCase()) {
        return NextResponse.json(
          apiError("INVALID_SIGNATURE", "Signature does not match creator", { creator }),
          { status: 403 }
        );
      }
    } catch {
      return NextResponse.json(
        apiError("INVALID_SIGNATURE", "Failed to verify signature", { creator }),
        { status: 403 }
      );
    }

    const order: FxOrder = {
      id: `order-${now}-${Math.random().toString(36).slice(2, 8)}`,
      creator,
      fromToken,
      toToken,
      amountIn: amount.toString(),
      targetRate: requiresTargetRate ? rate : 0,
      deadline: now + hours * 60 * 60 * 1000,
      status: "pending",
      createdAt: now,
      checksCount: 0,
      conditionType: cType as FxOrder["conditionType"],
      ...(cType === "pct_change" && {
        pctChangeThreshold: parseFloat(pctChangeThreshold) || 5,
        pctChangeTimeframe: pctChangeTimeframe || "24h",
      }),
    };

    // Snapshot current rate for pct_change / crosses conditions
    if (order.conditionType && order.conditionType !== "rate_reaches") {
      try {
        const { getOnChainQuote } = await import("@/lib/mento-sdk");
        const currentQuote = await getOnChainQuote(fromToken as Parameters<typeof getOnChainQuote>[0], toToken as Parameters<typeof getOnChainQuote>[1], "1");
        order.referenceRate = currentQuote.rate;
      } catch { /* fallback: agent uses rateHistory[0] */ }
    }

    addOrder(order);

    return NextResponse.json({ order }, { status: 201 });
  }

  if (action === "cancel") {
    const { orderId, creator, signature, timestamp } = body;

    if (!orderId || !creator) {
      return NextResponse.json(
        apiError("MISSING_FIELDS", "Missing orderId or creator"),
        { status: 400 }
      );
    }
    if (!isAddress(creator)) {
      return NextResponse.json(
        apiError("INVALID_CREATOR", "Creator must be a valid address", { creator }),
        { status: 400 }
      );
    }
    if (!signature || !timestamp) {
      return NextResponse.json(
        apiError("MISSING_FIELDS", "Missing signature or timestamp", { signature, timestamp }),
        { status: 400 }
      );
    }
    const ts = Number(timestamp);
    if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > MAX_CLOCK_SKEW_MS) {
      return NextResponse.json(
        apiError("INVALID_TIMESTAMP", "Timestamp is invalid or too old", { timestamp }),
        { status: 400 }
      );
    }

    const order = getOrder(orderId);
    if (!order) {
      return NextResponse.json(
        apiError("ORDER_NOT_FOUND", "Order not found", { orderId }),
        { status: 404 }
      );
    }

    if (order.creator.toLowerCase() !== creator.toLowerCase()) {
      return NextResponse.json(
        apiError("ORDER_NOT_PENDING", "Only the order creator can cancel"),
        { status: 403 }
      );
    }

    // Verify creator signature for cancellation
    const cancelMessage = [
      "CeloFX Order Cancel",
      `orderId:${orderId}`,
      `creator:${creator.toLowerCase()}`,
      `timestamp:${ts}`,
    ].join("\n");
    try {
      const recovered = await recoverMessageAddress({ message: cancelMessage, signature });
      if (recovered.toLowerCase() !== creator.toLowerCase()) {
        return NextResponse.json(
          apiError("INVALID_SIGNATURE", "Signature does not match creator", { creator }),
          { status: 403 }
        );
      }
    } catch {
      return NextResponse.json(
        apiError("INVALID_SIGNATURE", "Failed to verify signature", { creator }),
        { status: 403 }
      );
    }

    if (order.status !== "pending") {
      return NextResponse.json(
        apiError("ORDER_NOT_PENDING", `Cannot cancel order with status: ${order.status}`, { status: order.status }),
        { status: 400 }
      );
    }

    updateOrder(orderId, { status: "cancelled" });

    return NextResponse.json({
      order: { ...order, status: "cancelled" },
    });
  }

  return NextResponse.json(
    apiError("MISSING_FIELDS", "Invalid action. Use 'create' or 'cancel'"),
    { status: 400 }
  );
}
