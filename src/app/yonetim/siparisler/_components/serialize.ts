import type { OrderRow } from "./order-list";
import { toNumber, toNumberOrNull, type MoneyInput } from "@/lib/money";

type DateLike = Date | string | null | undefined;

type OrderLike = {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: MoneyInput;
  createdAt: Date | string;
  cancelledAt?: DateLike;
  cancellationReason?: string | null;
  refundedAt?: DateLike;
  refundAmount?: MoneyInput;
  serviceId?: string | null;
  suspendReason?: string | null;
  customer: { id: string; name: string; surname: string; email: string };
  product: { id?: string; name: string; sku?: string; category?: { name: string } | null };
};

const iso = (d: DateLike) => (d ? new Date(d).toISOString() : null);

/** Server → client: dates to ISO strings, money to numbers, only the fields the lists use. */
export function serializeOrder(o: OrderLike): OrderRow {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    totalAmount: toNumber(o.totalAmount),
    createdAt: new Date(o.createdAt).toISOString(),
    cancelledAt: iso(o.cancelledAt),
    cancellationReason: o.cancellationReason ?? null,
    refundedAt: iso(o.refundedAt),
    refundAmount: toNumberOrNull(o.refundAmount),
    serviceId: o.serviceId ?? null,
    suspendReason: o.suspendReason ?? null,
    customer: { id: o.customer.id, name: o.customer.name, surname: o.customer.surname, email: o.customer.email },
    product: {
      id: o.product.id,
      name: o.product.name,
      sku: o.product.sku,
      category: o.product.category ? { name: o.product.category.name } : null,
    },
  };
}

/** List pages default to 100 rows per server page unless `?perPage=` is set. */
export function withDefaultPerPage(sp: Record<string, string | string[] | undefined>) {
  return { perPage: "100", ...sp };
}

const tr = (s: string | null | undefined) => (s ?? "").toLocaleLowerCase("tr-TR");

/** Search of the order tables (and their CSV export); `q` is already lower-cased. */
export function orderSearch(o: OrderRow, q: string) {
  return (
    tr(o.orderNumber).includes(q) ||
    tr(`${o.customer.name} ${o.customer.surname}`.trim()).includes(q) ||
    tr(o.customer.email).includes(q) ||
    tr(o.product.name).includes(q)
  );
}

export const ORDER_FILTER_VALUES: Record<string, (o: OrderRow) => string> = {
  status: (o) => o.status,
};
