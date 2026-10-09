import type { Metadata } from "next";
import { isTwoFactorGloballyEnabled } from "@/lib/auth/two-factor-settings";
import { getSettingValue, isEnabled } from "@/lib/integrations/settings";
import { listStaffApiTokens, tokenState } from "@/lib/admin-api/tokens";
import { effectiveScopes } from "@/lib/admin-api/scopes";
import { listStaff } from "@/lib/staff/staff";
import { STAFF_TWO_FACTOR_SETTING, requirePermission } from "@/lib/utils/auth-helpers";
import { PersonelContent, type StaffRow, type StaffTokenRow } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Personel" };

export default async function PersonelPage() {
  const session = await requirePermission("staff.manage");
  const [staff, requireTwoFactor, twoFactorGloballyEnabled, tokens] = await Promise.all([
    listStaff(),
    getSettingValue(STAFF_TWO_FACTOR_SETTING, undefined, "false").then(isEnabled),
    isTwoFactorGloballyEnabled(),
    listStaffApiTokens(),
  ]);

  const rows: StaffRow[] = staff.map((u) => ({
    id: u.id,
    email: u.email,
    name: `${u.name} ${u.surname}`.trim() || u.email,
    role: u.role as StaffRow["role"],
    status: u.status,
    twoFactorEnabled: u.twoFactorEnabled,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
  }));

  const tokenRows: StaffTokenRow[] = tokens.map((token) => ({
    id: token.id,
    name: token.name,
    prefix: token.tokenPrefix,
    owner: `${token.user.name} ${token.user.surname}`.trim() || token.user.email,
    ownerEmail: token.user.email,
    scopes: token.scopes.length,
    effectiveScopes: effectiveScopes(token.scopes, token.user.status === "ACTIVE" ? token.user.role : null).length,
    expiresAt: token.expiresAt?.toISOString() ?? null,
    lastUsedAt: token.lastUsedAt?.toISOString() ?? null,
    lastUsedIp: token.lastUsedIp,
    state: tokenState(token),
  }));

  return (
    <PersonelContent
      tokens={tokenRows}
      staff={rows}
      currentUserId={session.user.id}
      requireTwoFactor={requireTwoFactor}
      twoFactorGloballyEnabled={twoFactorGloballyEnabled}
    />
  );
}
