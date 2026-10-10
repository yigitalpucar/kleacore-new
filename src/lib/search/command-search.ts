import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hasPermission, type Permission } from "@/lib/auth/permissions";
import { formatDate } from "@/lib/format/date";

/**
 * Data search behind the ⌘K palette (customer panel + admin panel).
 *
 *  - Customer search: every query carries `customerId = <session user>`;
 *    there is no parameter that widens it.
 *  - Staff search: each result group runs only when the role holds the
 *    permission that opens its detail page (customers.view, invoices.view…).
 *
 * Callers (route handlers) authenticate, rate-limit and pass the session.
 */

export const SEARCH_MIN_CHARS = 2;
export const SEARCH_MAX_CHARS = 64;
const PER_GROUP = 5;

export type SearchStatusKind = "service" | "invoice" | "order" | "ticket" | "domain" | "user";

export interface SearchHit {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  status?: { kind: SearchStatusKind; value: string };
  /** Secondary action shown on the row (customer: "Öde" on unpaid invoices). */
  action?: { label: string; href: string };
}

export interface SearchGroup {
  key: SearchGroupKey;
  label: string;
  hits: SearchHit[];
}

export type SearchGroupKey = "customers" | "services" | "domains" | "invoices" | "orders" | "tickets";

const GROUP_LABELS: Record<SearchGroupKey, string> = {
  customers: "Müşteriler",
  services: "Hizmetler",
  domains: "Alan adları",
  invoices: "Faturalar",
  orders: "Siparişler",
  tickets: "Destek talepleri",
};

/** Trimmed, whitespace-collapsed query; null when shorter than 2 characters. */
export function normalizeSearchQuery(raw: string | null | undefined): string | null {
  const q = (raw ?? "").replace(/\s+/g, " ").trim().slice(0, SEARCH_MAX_CHARS);
  return q.length >= SEARCH_MIN_CHARS ? q : null;
}

const has = (q: string) => ({ contains: q, mode: "insensitive" as const });
const groups = (list: SearchGroup[]) => list.filter((g) => g.hits.length > 0);

// ---------------------------------------------------------------------------
// Customer
// ---------------------------------------------------------------------------

const C = "/musteri/panel";

export async function searchCustomerRecords(userId: string, query: string): Promise<SearchGroup[]> {
  if (!userId) return [];
  const owner = { customerId: userId };

  const [services, domains, invoices, tickets] = await Promise.all([
    db.service.findMany({
      where: {
        ...owner,
        OR: [{ label: has(query) }, { domain: has(query) }, { ipAddress: has(query) }, { product: { name: has(query) } }],
      },
      select: { id: true, label: true, domain: true, status: true, product: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: PER_GROUP,
    }),
    db.domain.findMany({
      where: { ...owner, name: has(query) },
      select: { id: true, name: true, status: true, expiresAt: true },
      orderBy: { name: "asc" },
      take: PER_GROUP,
    }),
    db.invoice.findMany({
      where: { ...owner, invoiceNumber: has(query) },
      select: { id: true, invoiceNumber: true, status: true, dueDate: true },
      orderBy: { issuedAt: "desc" },
      take: PER_GROUP,
    }),
    db.supportTicket.findMany({
      where: { ...owner, OR: [{ ticketNumber: has(query) }, { subject: has(query) }] },
      select: { id: true, ticketNumber: true, subject: true, status: true },
      orderBy: { updatedAt: "desc" },
      take: PER_GROUP,
    }),
  ]);

  return groups([
    {
      key: "services",
      label: GROUP_LABELS.services,
      hits: services.map((s) => ({
        id: s.id,
        title: s.label || s.product.name,
        subtitle: [s.domain, s.label ? s.product.name : null].filter(Boolean).join(" · ") || undefined,
        href: `${C}/hizmetlerim/${s.id}`,
        status: { kind: "service", value: s.status },
      })),
    },
    {
      key: "domains",
      label: GROUP_LABELS.domains,
      hits: domains.map((d) => ({
        id: d.id,
        title: d.name,
        subtitle: `Bitiş: ${formatDate(d.expiresAt)}`,
        href: `${C}/domainler/${d.id}`,
        status: { kind: "domain", value: d.status },
      })),
    },
    {
      key: "invoices",
      label: GROUP_LABELS.invoices,
      hits: invoices.map((i) => {
        const href = `${C}/faturalar/${i.id}`;
        const unpaid = i.status === "PENDING" || i.status === "OVERDUE";
        return {
          id: i.id,
          title: i.invoiceNumber,
          subtitle: `Son ödeme: ${formatDate(i.dueDate)}`,
          href,
          status: { kind: "invoice", value: i.status },
          ...(unpaid ? { action: { label: "Öde", href } } : {}),
        };
      }),
    },
    {
      key: "tickets",
      label: GROUP_LABELS.tickets,
      hits: tickets.map((t) => ({
        id: t.id,
        title: t.subject,
        subtitle: t.ticketNumber,
        href: `${C}/destek/${t.id}`,
        status: { kind: "ticket", value: t.status },
      })),
    },
  ]);
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

const A = "/yonetim";

/** Group → permission that opens its detail page (same as ADMIN_ROUTE_PERMISSIONS). */
export const STAFF_SEARCH_PERMISSIONS: Record<SearchGroupKey, Permission> = {
  customers: "customers.view",
  invoices: "invoices.view",
  services: "services.view",
  domains: "domains.view",
  orders: "orders.view",
  tickets: "tickets.view",
};

export const STAFF_SEARCH_ANY: Permission[] = [...new Set(Object.values(STAFF_SEARCH_PERMISSIONS))];

/** Result groups this role may search, in display order. */
export function staffSearchGroups(role: unknown): SearchGroupKey[] {
  const order: SearchGroupKey[] = ["customers", "invoices", "orders", "services", "domains", "tickets"];
  return order.filter((key) => hasPermission(role, STAFF_SEARCH_PERMISSIONS[key]));
}

const fullName = (u: { name: string; surname: string }) => `${u.name} ${u.surname}`.trim();
const customerSelect = { select: { name: true, surname: true, companyName: true } } as const;
const customerLabel = (u: { name: string; surname: string; companyName: string | null } | null) =>
  u ? u.companyName || fullName(u) : undefined;

type Runner = (query: string) => Promise<SearchHit[]>;

const staffRunners: Record<SearchGroupKey, Runner> = {
  async customers(query) {
    const digits = query.replace(/\D/g, "");
    const or: Prisma.UserWhereInput[] = [
      { name: has(query) },
      { surname: has(query) },
      { email: has(query) },
      { companyName: has(query) },
      ...(digits.length >= 2 ? [{ taxNumber: { contains: digits } }, { phone: { contains: digits } }] : []),
    ];
    // "Ayşe Yılmaz": first word in name, the rest in surname.
    const [first, ...rest] = query.split(" ");
    if (rest.length) or.push({ AND: [{ name: has(first) }, { surname: has(rest.join(" ")) }] });
    const rows = await db.user.findMany({
      where: { role: "CUSTOMER", OR: or },
      select: { id: true, name: true, surname: true, email: true, companyName: true, taxNumber: true, status: true },
      orderBy: { createdAt: "desc" },
      take: PER_GROUP,
    });
    return rows.map((u) => ({
      id: u.id,
      title: u.companyName || fullName(u) || u.email,
      subtitle: [u.companyName ? fullName(u) : null, u.email, u.taxNumber ? `VKN ${u.taxNumber}` : null].filter(Boolean).join(" · "),
      href: `${A}/musteriler/${u.id}`,
      status: { kind: "user", value: u.status },
    }));
  },
  async invoices(query) {
    const rows = await db.invoice.findMany({
      where: { invoiceNumber: has(query) },
      select: { id: true, invoiceNumber: true, status: true, customer: customerSelect },
      orderBy: { issuedAt: "desc" },
      take: PER_GROUP,
    });
    return rows.map((i) => ({
      id: i.id,
      title: i.invoiceNumber,
      subtitle: customerLabel(i.customer),
      href: `${A}/faturalar/${i.id}`,
      status: { kind: "invoice", value: i.status },
    }));
  },
  async orders(query) {
    const rows = await db.order.findMany({
      where: { OR: [{ orderNumber: has(query) }, { domain: has(query) }] },
      select: { id: true, orderNumber: true, domain: true, status: true, customer: customerSelect },
      orderBy: { createdAt: "desc" },
      take: PER_GROUP,
    });
    return rows.map((o) => ({
      id: o.id,
      title: o.orderNumber,
      subtitle: [customerLabel(o.customer), o.domain].filter(Boolean).join(" · ") || undefined,
      href: `${A}/siparisler/${o.id}`,
      status: { kind: "order", value: o.status },
    }));
  },
  async services(query) {
    const rows = await db.service.findMany({
      where: {
        OR: [{ label: has(query) }, { domain: has(query) }, { ipAddress: has(query) }, { username: has(query) }, { product: { name: has(query) } }],
      },
      select: { id: true, label: true, domain: true, status: true, product: { select: { name: true } }, customer: customerSelect },
      orderBy: { createdAt: "desc" },
      take: PER_GROUP,
    });
    return rows.map((s) => ({
      id: s.id,
      title: s.domain || s.label || s.product.name,
      subtitle: [s.product.name, customerLabel(s.customer)].filter(Boolean).join(" · "),
      href: `${A}/hizmetler/${s.id}`,
      status: { kind: "service", value: s.status },
    }));
  },
  async domains(query) {
    const rows = await db.domain.findMany({
      where: { name: has(query) },
      select: { id: true, name: true, status: true, customer: customerSelect },
      orderBy: { name: "asc" },
      take: PER_GROUP,
    });
    return rows.map((d) => ({
      id: d.id,
      title: d.name,
      subtitle: customerLabel(d.customer),
      href: `${A}/domainler/${d.id}`,
      status: { kind: "domain", value: d.status },
    }));
  },
  async tickets(query) {
    const rows = await db.supportTicket.findMany({
      where: { OR: [{ ticketNumber: has(query) }, { subject: has(query) }, { guestEmail: has(query) }] },
      select: { id: true, ticketNumber: true, subject: true, status: true, guestName: true, customer: customerSelect },
      orderBy: { updatedAt: "desc" },
      take: PER_GROUP,
    });
    return rows.map((t) => ({
      id: t.id,
      title: t.subject,
      subtitle: [t.ticketNumber, customerLabel(t.customer) ?? t.guestName].filter(Boolean).join(" · "),
      href: `${A}/destek/${t.id}`,
      status: { kind: "ticket", value: t.status },
    }));
  },
};

export async function searchStaffRecords(role: unknown, query: string): Promise<SearchGroup[]> {
  const keys = staffSearchGroups(role);
  const results = await Promise.all(keys.map((key) => staffRunners[key](query)));
  return groups(keys.map((key, i) => ({ key, label: GROUP_LABELS[key], hits: results[i] })));
}
