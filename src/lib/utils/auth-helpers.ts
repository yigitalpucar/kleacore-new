import { auth } from "@/lib/auth";
import {
  hasAnyPermission,
  hasPermission,
  isStaffRole,
  type Permission,
  type StaffRole,
} from "@/lib/auth/permissions";
import { isTwoFactorGloballyEnabled } from "@/lib/auth/two-factor-settings";
import { db } from "@/lib/db";
import { getSettingValue, isEnabled } from "@/lib/integrations/settings";
import { forbidden, redirect } from "next/navigation";

export const STAFF_TWO_FACTOR_SETTING = "require_staff_2fa";
/** Where staff without 2FA are sent when `require_staff_2fa` is on. */
export const STAFF_TWO_FACTOR_SETUP_PATH = "/musteri/panel/ayarlar?2fa=personel";

export async function getSession() {
  return await auth();
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    redirect("/musteri/giris");
  }
  return session;
}

/**
 * True when the owner requires staff 2FA and this user has not set it up.
 * Ignored while 2FA is switched off globally (Ayarlar → Güvenlik): staff could
 * not enable it then, and login would not ask for it anyway.
 */
export async function staffTwoFactorMissing(userId: string) {
  if (!isEnabled(await getSettingValue(STAFF_TWO_FACTOR_SETTING, undefined, "false"))) return false;
  if (!(await isTwoFactorGloballyEnabled())) return false;
  const user = await db.user.findUnique({ where: { id: userId }, select: { twoFactorEnabled: true } });
  return !user?.twoFactorEnabled;
}

/**
 * Any staff role (ADMIN, SUPPORT, BILLING). Not signed in / customer → login
 * (as before); staff without required 2FA → 2FA setup.
 */
export async function requireStaff() {
  const session = await auth();
  if (!session?.user || !isStaffRole(session.user.role)) {
    redirect("/musteri/giris");
  }
  if (await staffTwoFactorMissing(session.user.id)) {
    redirect(STAFF_TWO_FACTOR_SETUP_PATH);
  }
  return session as typeof session & { user: { role: StaffRole } };
}

/**
 * Staff member holding `permission` (ADMIN holds all). Staff without it get
 * the 403 page (`forbidden()`), in pages, server actions and route handlers.
 */
export async function requirePermission(permission: Permission) {
  const session = await requireStaff();
  if (!hasPermission(session.user.role, permission)) {
    forbidden();
  }
  return session;
}

/** Staff member holding at least one of `permissions`. */
export async function requireAnyPermission(...permissions: Permission[]) {
  const session = await requireStaff();
  if (!hasAnyPermission(session.user.role, permissions)) {
    forbidden();
  }
  return session;
}

/**
 * Full admin (role ADMIN). Kept for code that has not been mapped to a
 * specific permission yet; prefer `requirePermission`.
 */
export async function requireAdmin() {
  const session = await requireStaff();
  if (session.user.role !== "ADMIN") {
    forbidden();
  }
  return session;
}

/**
 * Route-handler variant: returns the session, or "unauthorized" / "forbidden"
 * so the handler can answer 401 / 403 JSON instead of redirecting.
 */
export async function checkApiPermission(permission: Permission) {
  const session = await auth();
  if (!session?.user) return { ok: false as const, status: 401 as const };
  if (!isStaffRole(session.user.role) || !hasPermission(session.user.role, permission)) {
    return { ok: false as const, status: 403 as const };
  }
  if (await staffTwoFactorMissing(session.user.id)) return { ok: false as const, status: 403 as const };
  return { ok: true as const, session };
}

export async function requireCustomer() {
  const session = await auth();
  if (!session?.user) {
    redirect("/musteri/giris");
  }
  return session;
}

export async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}
