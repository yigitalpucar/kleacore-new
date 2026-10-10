/**
 * Admin list views (UI3 item 11): the search text and filter values of an
 * admin table as a query string, shared by saved filters, the CSV export
 * route and the tables themselves. Pure module (client + server).
 *
 * Query string: `q` = search text, `f_<filterId>` = filter value ("all" is
 * omitted). Anything else (page, perPage, scope) is ignored here.
 */
import { hasPermission, type Permission } from "@/lib/auth/permissions";

export const ADMIN_LISTS = ["invoices", "services", "customers", "orders", "tickets"] as const;
export type AdminListKey = (typeof ADMIN_LISTS)[number];

export function isAdminListKey(value: unknown): value is AdminListKey {
  return typeof value === "string" && (ADMIN_LISTS as readonly string[]).includes(value);
}

/** Permission needed to see (and so to save filters for / export) each list. */
export const LIST_VIEW_PERMISSION: Record<AdminListKey, Permission> = {
  invoices: "invoices.view",
  services: "services.view",
  customers: "customers.view",
  orders: "orders.view",
  tickets: "tickets.view",
};

/** Route prefix every saved view of a list must live under. */
export const LIST_ROUTE_PREFIX: Record<AdminListKey, string> = {
  invoices: "/yonetim/faturalar",
  services: "/yonetim/hizmetler",
  customers: "/yonetim/musteriler",
  orders: "/yonetim/siparisler",
  tickets: "/yonetim/destek",
};

export const LIST_LABELS: Record<AdminListKey, string> = {
  invoices: "Faturalar",
  services: "Hizmetler",
  customers: "Müşteriler",
  orders: "Siparişler",
  tickets: "Destek talepleri",
};

export interface ListView {
  q: string;
  filters: Record<string, string>;
}

const MAX_QUERY = 200;
const VALUE_RE = /^[A-Za-z0-9_.-]{1,64}$/;
const ID_RE = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;

type ParamSource = URLSearchParams | { get(name: string): string | null } | Record<string, string | string[] | undefined>;

function reader(params: ParamSource) {
  if (typeof (params as { get?: unknown }).get === "function") {
    return (name: string) => (params as { get(name: string): string | null }).get(name);
  }
  return (name: string) => {
    const v = (params as Record<string, string | string[] | undefined>)[name];
    return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
  };
}

/**
 * Reads `q` and `f_<id>` for the given filter ids. Unknown filters and
 * malformed values are dropped; missing filters fall back to `defaults`
 * (then "all").
 */
export function parseListView(
  params: ParamSource,
  filterIds: readonly string[],
  defaults: Record<string, string> = {}
): ListView {
  const read = reader(params);
  const q = (read("q") ?? "").slice(0, MAX_QUERY);
  const filters: Record<string, string> = {};
  for (const id of filterIds) {
    const raw = read(`f_${id}`);
    filters[id] = raw && VALUE_RE.test(raw) ? raw : (defaults[id] ?? "all");
  }
  return { q, filters };
}

/** View → query string params (stable order; "all" and empty values omitted). */
export function listViewToParams(view: ListView): URLSearchParams {
  const params = new URLSearchParams();
  const q = view.q.trim().slice(0, MAX_QUERY);
  if (q) params.set("q", q);
  for (const id of Object.keys(view.filters).sort()) {
    const value = view.filters[id];
    if (!ID_RE.test(id) || !value || value === "all" || !VALUE_RE.test(value)) continue;
    params.set(`f_${id}`, value);
  }
  return params;
}

/** Short human summary of a view for the saved-filter list ("“acme” · 2 filtre"). */
export function describeListView(view: ListView): string {
  const parts: string[] = [];
  if (view.q.trim()) parts.push(`“${view.q.trim()}”`);
  const active = Object.values(view.filters).filter((v) => v && v !== "all").length;
  if (active) parts.push(`${active} filtre`);
  return parts.join(" · ") || "Filtresiz";
}

/** A saved view's path must be under its list's route (no open redirects). */
export function isValidListPath(list: AdminListKey, path: string): boolean {
  const prefix = LIST_ROUTE_PREFIX[list];
  return (path === prefix || path.startsWith(`${prefix}/`)) && /^\/[a-z0-9/_-]*$/.test(path) && !path.includes("//");
}

/** What a staff role may do on an admin list (computed on the server, passed to the table). */
export interface ListCapabilities {
  /** Bulk action ids allowed for the role (same permission as the single action). */
  bulk: string[];
  export: boolean;
}

/** Bulk actions per list → the permission of the single action they repeat. */
export const BULK_ACTION_PERMISSIONS: Record<AdminListKey, Record<string, Permission>> = {
  invoices: { remind: "invoices.edit", cancel: "invoices.edit" },
  services: { suspend: "services.manage", unsuspend: "services.manage" },
  customers: { suspend: "customers.edit", activate: "customers.edit" },
  orders: { cancel: "orders.manage" },
  tickets: { assign: "tickets.reply", close: "tickets.reply" },
};

export function listCapabilities(role: unknown, list: AdminListKey): ListCapabilities {
  const bulk = Object.entries(BULK_ACTION_PERMISSIONS[list])
    .filter(([, permission]) => hasPermission(role, permission))
    .map(([id]) => id);
  return {
    bulk,
    export: hasPermission(role, "export.csv") && hasPermission(role, LIST_VIEW_PERMISSION[list]),
  };
}
