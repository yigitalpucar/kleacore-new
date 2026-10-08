import type { Metadata } from "next";
import { isTwoFactorGloballyEnabled } from "@/lib/auth/two-factor-settings";
import { getSettingValue, isEnabled } from "@/lib/integrations/settings";
import { listStaff } from "@/lib/staff/staff";
import { STAFF_TWO_FACTOR_SETTING, requirePermission } from "@/lib/utils/auth-helpers";
import { PersonelContent, type StaffRow } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Personel" };

export default async function PersonelPage() {
  const session = await requirePermission("staff.manage");
  const [staff, requireTwoFactor, twoFactorGloballyEnabled] = await Promise.all([
    listStaff(),
    getSettingValue(STAFF_TWO_FACTOR_SETTING, undefined, "false").then(isEnabled),
    isTwoFactorGloballyEnabled(),
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

  return (
    <PersonelContent
      staff={rows}
      currentUserId={session.user.id}
      requireTwoFactor={requireTwoFactor}
      twoFactorGloballyEnabled={twoFactorGloballyEnabled}
    />
  );
}
