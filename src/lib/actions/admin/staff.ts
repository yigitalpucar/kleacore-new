"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity-log";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { createLogger } from "@/lib/logger";
import {
  StaffError,
  changeStaffRole,
  inviteStaff,
  sendStaffInvite,
  setStaffActive,
} from "@/lib/staff/staff";
import { db } from "@/lib/db";
import { STAFF_TWO_FACTOR_SETTING, requirePermission } from "@/lib/utils/auth-helpers";

const log = createLogger("staff");

type ActionResult = { success: true; message?: string } | { success: false; error: string };

function fail(error: unknown, fallback: string): ActionResult {
  if (error instanceof StaffError) return { success: false, error: error.message };
  log.error(fallback, { error });
  return { success: false, error: fallback };
}

function revalidate() {
  revalidatePath("/yonetim/personel");
  revalidatePath("/yonetim/aktivite");
}

export async function inviteStaffAction(input: {
  email: string;
  name: string;
  surname?: string;
  role: string;
}): Promise<ActionResult> {
  const session = await requirePermission("staff.manage");
  try {
    const user = await inviteStaff(input);
    await logActivity({
      userId: session.user.id,
      action: "STAFF_INVITE",
      entity: "User",
      entityId: user.id,
      details: { email: user.email, role: user.role },
    });
    let message = "Personel eklendi ve davet e-postası gönderildi.";
    try {
      await sendStaffInvite(user.id, { invitedBy: session.user.name ?? undefined });
    } catch (error) {
      log.error("staff invite mail failed", { error, userId: user.id });
      message = "Personel eklendi ancak davet e-postası gönderilemedi; listeden yeniden gönderin.";
    }
    revalidate();
    return { success: true, message };
  } catch (error) {
    return fail(error, "Personel eklenemedi.");
  }
}

export async function resendStaffInviteAction(userId: string): Promise<ActionResult> {
  const session = await requirePermission("staff.manage");
  try {
    await sendStaffInvite(userId, { invitedBy: session.user.name ?? undefined });
    await logActivity({
      userId: session.user.id,
      action: "STAFF_INVITE_RESEND",
      entity: "User",
      entityId: userId,
    });
    revalidate();
    return { success: true, message: "Davet e-postası yeniden gönderildi." };
  } catch (error) {
    return fail(error, "Davet e-postası gönderilemedi.");
  }
}

export async function changeStaffRoleAction(userId: string, role: string): Promise<ActionResult> {
  const session = await requirePermission("staff.manage");
  try {
    const result = await changeStaffRole(userId, role);
    if (result.before !== result.after) {
      await logActivity({
        userId: session.user.id,
        action: "STAFF_ROLE_CHANGE",
        entity: "User",
        entityId: userId,
        details: { from: result.before, to: result.after },
      });
    }
    revalidate();
    return {
      success: true,
      message: `Rol "${ROLE_LABELS[result.after]}" olarak güncellendi. Değişiklik en geç 5 dakika içinde oturuma yansır.`,
    };
  } catch (error) {
    return fail(error, "Rol güncellenemedi.");
  }
}

export async function setStaffActiveAction(userId: string, active: boolean): Promise<ActionResult> {
  const session = await requirePermission("staff.manage");
  try {
    await setStaffActive(userId, active, session.user.id);
    await logActivity({
      userId: session.user.id,
      action: active ? "STAFF_ACTIVATE" : "STAFF_DEACTIVATE",
      entity: "User",
      entityId: userId,
    });
    revalidate();
    return { success: true, message: active ? "Personel yeniden etkinleştirildi." : "Personel devre dışı bırakıldı." };
  } catch (error) {
    return fail(error, "Personel durumu güncellenemedi.");
  }
}

/** Ayar: require_staff_2fa — staff must enable 2FA before using /yonetim. */
export async function setRequireStaffTwoFactorAction(enabled: boolean): Promise<ActionResult> {
  const session = await requirePermission("staff.manage");
  try {
    if (enabled) {
      const me = await db.user.findUnique({ where: { id: session.user.id }, select: { twoFactorEnabled: true } });
      if (!me?.twoFactorEnabled) {
        return { success: false, error: "Zorunlu kılmadan önce kendi hesabınızda iki faktörlü doğrulamayı etkinleştirin." };
      }
    }
    const value = enabled ? "true" : "false";
    await db.setting.upsert({
      where: { key: STAFF_TWO_FACTOR_SETTING },
      update: { value },
      create: { key: STAFF_TWO_FACTOR_SETTING, value, group: "security" },
    });
    await logActivity({
      userId: session.user.id,
      action: "STAFF_2FA_REQUIREMENT",
      entity: "Setting",
      entityId: STAFF_TWO_FACTOR_SETTING,
      details: { enabled },
    });
    revalidate();
    return {
      success: true,
      message: enabled ? "Personel için iki adımlı doğrulama zorunlu." : "Personel için iki adımlı doğrulama zorunluluğu kaldırıldı.",
    };
  } catch (error) {
    return fail(error, "Ayar kaydedilemedi.");
  }
}
