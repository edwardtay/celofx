import { NextRequest, NextResponse } from "next/server";
import {
  getOrders,
  addOrder,
  getOrder,
  updateOrder,
} from "@/lib/order-store";
import type { FxOrder, OrderStatus } from "@/lib/types";

const VALID_TOKENS = ["cUSD", "cEUR", "cREAL", "USDC", "USDT"];

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
    const { creator, fromToken, toToken, amountIn, targetRate, deadlineHours, conditionType, pctChangeThreshold, pctChangeTimeframe } =
      body;

    const cType = conditionType || "rate_reaches";

    if (!creator || !fromToken || !toToken || !amountIn) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // For pct_change conditions, targetRate is optional (computed from current rate + threshold)
    if (cType === "rate_reaches" && !targetRate) {
      return NextResponse.json(
        { error: "Target rate required for rate-based alerts" },
        { status: 400 }
      );
    }

    if (!VALID_TOKENS.includes(fromToken) || !VALID_TOKENS.includes(toToken)) {
      return NextResponse.json(
        { error: "Invalid token. Use cUSD, cEUR, or cREAL" },
        { status: 400 }
      );
    }

    if (fromToken === toToken) {
      return NextResponse.json(
        { error: "From and to tokens must be different" },
        { status: 400 }
      );
    }

    const amount = parseFloat(amountIn);
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount" },
        { status: 400 }
      );
    }

    const rate = parseFloat(targetRate);
    if (isNaN(rate) || rate <= 0) {
      return NextResponse.json(
        { error: "Invalid target rate" },
        { status: 400 }
      );
    }

    const hours = parseFloat(deadlineHours) || 24;
    const now = Date.now();

    const order: FxOrder = {
      id: `order-${now}-${Math.random().toString(36).slice(2, 8)}`,
      creator,
      fromToken,
      toToken,
      amountIn: amount.toString(),
      targetRate: rate || 0,
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

    addOrder(order);

    return NextResponse.json({ order }, { status: 201 });
  }

  if (action === "cancel") {
    const { orderId, creator } = body;

    if (!orderId || !creator) {
      return NextResponse.json(
        { error: "Missing orderId or creator" },
        { status: 400 }
      );
    }

    const order = getOrder(orderId);
    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    if (order.creator.toLowerCase() !== creator.toLowerCase()) {
      return NextResponse.json(
        { error: "Only the order creator can cancel" },
        { status: 403 }
      );
    }

    if (order.status !== "pending") {
      return NextResponse.json(
        { error: `Cannot cancel order with status: ${order.status}` },
        { status: 400 }
      );
    }

    updateOrder(orderId, { status: "cancelled" });

    return NextResponse.json({
      order: { ...order, status: "cancelled" },
    });
  }

  return NextResponse.json(
    { error: "Invalid action. Use 'create' or 'cancel'" },
    { status: 400 }
  );
}
