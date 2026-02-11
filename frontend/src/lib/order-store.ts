import type { FxOrder, OrderStatus } from "./types";
import { seedOrders } from "./seed-orders";

const orders = new Map<string, FxOrder>();

for (const order of seedOrders) {
  orders.set(order.id, order);
}

export function getOrders(opts?: {
  status?: OrderStatus;
  creator?: string;
}): FxOrder[] {
  let result = Array.from(orders.values());

  if (opts?.status) {
    result = result.filter((o) => o.status === opts.status);
  }
  if (opts?.creator) {
    result = result.filter(
      (o) => o.creator.toLowerCase() === opts.creator!.toLowerCase()
    );
  }

  return result.sort((a, b) => b.createdAt - a.createdAt);
}

export function getOrder(id: string): FxOrder | undefined {
  return orders.get(id);
}

export function addOrder(order: FxOrder): void {
  orders.set(order.id, order);
}

export function updateOrder(id: string, update: Partial<FxOrder>): void {
  const existing = orders.get(id);
  if (existing) {
    orders.set(id, { ...existing, ...update });
  }
}

export function getOrderCount(status?: OrderStatus): number {
  if (!status) return orders.size;
  return Array.from(orders.values()).filter((o) => o.status === status).length;
}
