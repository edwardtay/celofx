import type { FxOrder, OrderStatus } from "./types";
import { seedOrders } from "./seed-orders";
import { loadJsonSync, writeJson } from "./persist";

const orders = new Map<string, FxOrder>();

const persisted = loadJsonSync<FxOrder[]>("orders.json", []);
const initialOrders = persisted.length > 0 ? persisted : seedOrders;
for (const order of initialOrders) {
  orders.set(order.id, order);
}

function persist() {
  writeJson("orders.json", Array.from(orders.values()));
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
  persist();
}

export function updateOrder(id: string, update: Partial<FxOrder>): void {
  const existing = orders.get(id);
  if (existing) {
    orders.set(id, { ...existing, ...update });
    persist();
  }
}

export function getOrderCount(status?: OrderStatus): number {
  if (!status) return orders.size;
  return Array.from(orders.values()).filter((o) => o.status === status).length;
}
