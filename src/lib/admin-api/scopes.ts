/**
 * Admin API scopes are permission names (src/lib/auth/permissions.ts). A
 * token's effective scopes are its stored scopes ∩ the owner's CURRENT role
 * permissions — computed per request, never stored.
 *
 * Pure module (client-safe): the token form uses the labels.
 */
import { PERMISSIONS, permissionsForRole, type Permission } from "@/lib/auth/permissions";

/** Turkish labels for the scope picker (missing → the permission name). */
export const SCOPE_LABELS: Partial<Record<Permission, string>> = {
  "customers.view": "Müşterileri görüntüleme",
  "customers.edit": "Müşteri oluşturma / düzenleme",
  "tickets.view": "Destek taleplerini görüntüleme",
  "tickets.reply": "Destek taleplerini yanıtlama / kapatma",
  "invoices.view": "Faturaları görüntüleme",
  "invoices.edit": "Fatura oluşturma, ödendi işaretleme, hatırlatma",
  "payments.refund": "İade",
  "bank_transfers.approve": "Havale onayı",
  "orders.view": "Siparişleri görüntüleme",
  "orders.manage": "Sipariş onaylama",
  "services.view": "Hizmetleri görüntüleme",
  "services.manage": "Hizmet askıya alma / açma / sonlandırma",
  "provisioning.manage": "Kurulum yeniden deneme",
  "reports.view": "Raporlar (MRR, alacaklar)",
  "activity.view": "Olay kayıtları",
  "domains.view": "Alan adlarını görüntüleme",
  "domains.manage": "Alan adı senkronu / yenileme",
  "jobs.manage": "Arka plan işleri",
};

export function scopeLabel(scope: string): string {
  return SCOPE_LABELS[scope as Permission] ?? scope;
}

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

/** Stored scopes that the owner's role still grants. Unknown names are dropped. */
export function effectiveScopes(scopes: readonly string[], ownerRole: unknown): Permission[] {
  const granted = permissionsForRole(ownerRole);
  return scopes.filter((scope): scope is Permission => isPermission(scope) && granted.includes(scope));
}
