import type { getServices } from "@/lib/dal/services";

/** Plain service row of the admin service lists (and their CSV export). */
export type ServiceListRow = {
  id: string;
  label: string;
  domain: string | null;
  ipAddress: string | null;
  serverName: string | null;
  status: string;
  billingPeriod: string;
  /** Charge for ONE billing period (yearly services store the yearly total). */
  amount: number;
  nextDueDate: string | null;
  suspendReason: string | null;
  createdAt: string;
  customer: { id: string; name: string; email: string };
  product: { name: string; sku: string; categorySlug: string | null; categoryName: string | null };
};

type ServiceListItem = Awaited<ReturnType<typeof getServices>>["data"][number];

export function toServiceListRow(s: ServiceListItem): ServiceListRow {
  return {
    id: s.id,
    label: s.label,
    domain: s.domain,
    ipAddress: s.ipAddress,
    serverName: s.serverName,
    status: s.status,
    billingPeriod: s.billingPeriod,
    amount: Number(s.amount),
    nextDueDate: s.nextDueDate ? s.nextDueDate.toISOString() : null,
    suspendReason: s.suspendReason,
    createdAt: s.createdAt.toISOString(),
    customer: {
      id: s.customer.id,
      name: `${s.customer.name} ${s.customer.surname}`.trim(),
      email: s.customer.email,
    },
    product: {
      name: s.product.name,
      sku: s.product.sku,
      categorySlug: s.product.category?.slug ?? null,
      categoryName: s.product.category?.name ?? null,
    },
  };
}

const tr = (s: string | null | undefined) => (s ?? "").toLocaleLowerCase("tr-TR");

/** `q` is already lower-cased. */
export function serviceSearch(s: ServiceListRow, q: string) {
  return (
    tr(s.id).includes(q) ||
    tr(s.domain).includes(q) ||
    tr(s.label).includes(q) ||
    tr(s.ipAddress).includes(q) ||
    tr(s.customer.name).includes(q) ||
    tr(s.customer.email).includes(q) ||
    tr(s.product.name).includes(q)
  );
}

export const SERVICE_FILTER_VALUES: Record<string, (r: ServiceListRow) => string> = {
  status: (r) => r.status,
};
