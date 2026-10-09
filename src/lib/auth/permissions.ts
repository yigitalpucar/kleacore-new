/**
 * Staff roles and permissions (roadmap 3.6).
 *
 * The matrix lives in code, not in a table: a handful of staff, three roles,
 * and every check is greppable. ADMIN holds every permission (including any
 * added later); SUPPORT and BILLING get the explicit lists below. CUSTOMER is
 * not staff and has none.
 *
 * Pure module (no server imports) so the admin nav can filter with it on the
 * client. Server-side enforcement: `requirePermission` in
 * src/lib/utils/auth-helpers.ts.
 */

export const PERMISSIONS = [
  "customers.view",
  "customers.edit",
  "tickets.view",
  "tickets.reply",
  "invoices.view",
  "invoices.edit",
  "payments.refund",
  "bank_transfers.approve",
  "orders.view",
  "orders.manage",
  "services.view",
  "services.manage",
  "provisioning.manage",
  /** VDS backups on the admin side: restore, delete, extra slots, final backup (incl. skipping it on termination). */
  "backups.manage",
  "products.manage",
  "content.manage",
  "settings.manage",
  "modules.manage",
  "imports.run",
  "reports.view",
  "staff.manage",
  "activity.view",
  /** Only the staff member's own activity log entries. */
  "activity.view_own",
  "efatura.manage",
  "domains.view",
  "domains.manage",
  "dns.manage",
  "jobs.manage",
  "status.manage",
  /** Own Admin API tokens (/api/admin/v1); scopes never exceed the owner's permissions. */
  "api_tokens.manage",
  /** Identity (KYC) documents: view, approve, reject. ADMIN only by default (KVKK: least access). */
  "kyc.review",
  /** KVKK data-subject requests: exports, anonymisation (ADMIN only by default). */
  "privacy.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const STAFF_ROLES = ["ADMIN", "SUPPORT", "BILLING"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export type AppRole = StaffRole | "CUSTOMER";

export const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: "Yönetici",
  SUPPORT: "Destek",
  BILLING: "Muhasebe",
  CUSTOMER: "Müşteri",
};

export const ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  ADMIN: "Tüm yetkiler.",
  SUPPORT: "Destek talepleri, müşteri/hizmet/alan adı görüntüleme, kendi aktivite kayıtları.",
  BILLING: "Faturalar, iade, havale onayı, e-fatura, raporlar; müşteri ve sipariş görüntüleme.",
};

const ROLE_PERMISSIONS: Record<Exclude<StaffRole, "ADMIN">, readonly Permission[]> = {
  SUPPORT: [
    "customers.view",
    "tickets.view",
    "tickets.reply",
    "services.view",
    "domains.view",
    "activity.view_own",
    "api_tokens.manage",
  ],
  BILLING: [
    "customers.view",
    "invoices.view",
    "invoices.edit",
    "payments.refund",
    "bank_transfers.approve",
    "efatura.manage",
    "reports.view",
    "orders.view",
    "api_tokens.manage",
  ],
};

export function isStaffRole(role: unknown): role is StaffRole {
  return typeof role === "string" && (STAFF_ROLES as readonly string[]).includes(role);
}

export function permissionsForRole(role: unknown): readonly Permission[] {
  if (role === "ADMIN") return PERMISSIONS;
  if (role === "SUPPORT" || role === "BILLING") return ROLE_PERMISSIONS[role];
  return [];
}

export function hasPermission(role: unknown, permission: Permission): boolean {
  if (role === "ADMIN") return true;
  return permissionsForRole(role).includes(permission);
}

export function hasAnyPermission(role: unknown, permissions: readonly Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

/**
 * /yonetim route prefix → permissions (any of them grants access). Longest
 * prefix wins. Used for nav filtering and checked against every page's
 * `requirePermission` call by src/lib/auth/permissions.pages.test.ts.
 * `null` = any staff member. Unlisted /yonetim routes are ADMIN-only.
 */
export const ADMIN_ROUTE_PERMISSIONS: Record<string, readonly Permission[] | null> = {
  "/yonetim": null,
  "/yonetim/yetkisiz": null,
  "/yonetim/musteriler": ["customers.view"],
  "/yonetim/musteri-ekle": ["customers.edit"],
  "/yonetim/bayiler": ["customers.view"],
  "/yonetim/affiliate-odemeleri": ["invoices.edit"],
  "/yonetim/siparisler": ["orders.view"],
  /** Order risk review queue (decisions need orders.manage). */
  "/yonetim/siparisler/inceleme": ["orders.view"],
  "/yonetim/siparisler/inceleme/ayarlar": ["settings.manage"],
  "/yonetim/kyc": ["kyc.review"],
  "/yonetim/hizmetler": ["services.view"],
  "/yonetim/hizmet-ekle": ["services.manage"],
  "/yonetim/kurulumlar": ["provisioning.manage"],
  "/yonetim/provisioning": ["provisioning.manage"],
  "/yonetim/sunucular": ["provisioning.manage"],
  "/yonetim/ip-havuzlari": ["provisioning.manage"],
  "/yonetim/domainler": ["domains.view"],
  "/yonetim/dns": ["dns.manage"],
  "/yonetim/faturalar": ["invoices.view"],
  "/yonetim/faturalar/olustur": ["invoices.edit"],
  "/yonetim/faturalar/otomatik-tahsilat": ["invoices.edit"],
  "/yonetim/efatura": ["efatura.manage"],
  "/yonetim/urunler": ["products.manage"],
  "/yonetim/urunler/tld-fiyatlari": ["products.manage"],
  "/yonetim/ice-aktar": ["imports.run"],
  "/yonetim/destek": ["tickets.view"],
  "/yonetim/destek/hazir-yanitlar": ["tickets.reply"],
  "/yonetim/destek/ayarlar": ["settings.manage"],
  "/yonetim/icerik": ["content.manage"],
  "/yonetim/raporlar": ["reports.view"],
  "/yonetim/durum": ["status.manage"],
  "/yonetim/isler": ["jobs.manage"],
  "/yonetim/bildirimler": ["settings.manage"],
  "/yonetim/aktivite": ["activity.view", "activity.view_own"],
  /** Domain event log (payloads of every business event; redelivery needs jobs.manage). */
  "/yonetim/olaylar": ["activity.view"],
  "/yonetim/moduller": ["modules.manage"],
  "/yonetim/entegrasyonlar": ["settings.manage"],
  "/yonetim/ayarlar": ["settings.manage"],
  "/yonetim/personel": ["staff.manage"],
  "/yonetim/api-tokenlari": ["api_tokens.manage"],
  "/yonetim/kvkk-talepleri": ["privacy.manage"],
};

/**
 * Permissions guarding a /yonetim path: `null` = any staff, `undefined` =
 * not mapped (ADMIN-only).
 */
export function routePermissions(pathname: string): readonly Permission[] | null | undefined {
  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  let best: string | undefined;
  for (const prefix of Object.keys(ADMIN_ROUTE_PERMISSIONS)) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      if (!best || prefix.length > best.length) best = prefix;
    }
  }
  if (best === "/yonetim" && path !== "/yonetim") return undefined;
  return best === undefined ? undefined : ADMIN_ROUTE_PERMISSIONS[best];
}

export function canAccessRoute(role: unknown, pathname: string): boolean {
  if (!isStaffRole(role)) return false;
  if (role === "ADMIN") return true;
  if (!pathname.startsWith("/yonetim")) return true;
  const required = routePermissions(pathname);
  if (required === null) return true;
  if (required === undefined) return false;
  return hasAnyPermission(role, required);
}
