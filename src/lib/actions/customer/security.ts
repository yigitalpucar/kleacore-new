"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { signIn } from "@/lib/auth";
import { issueLoginToken } from "@/lib/auth/login-token";
import {
  revokeAllTrustedDevices,
  revokeTrustedDevice,
  trustedDeviceCookieName,
} from "@/lib/auth/trusted-device";
import { db } from "@/lib/db";
import { getRequestMeta } from "@/lib/request-meta";
import { recordLoginEvent } from "@/lib/security/login-events";
import { requireCustomer } from "@/lib/utils/auth-helpers";

const SETTINGS_PATH = "/musteri/panel/ayarlar";

/** Removes one remembered device: the next login there asks for the 2FA code again. */
export async function removeTrustedDeviceAction(deviceId: string) {
  const session = await requireCustomer();
  if (typeof deviceId !== "string" || !deviceId) return { success: false, error: "Geçersiz cihaz" };

  const removed = await revokeTrustedDevice(session.user.id, deviceId);
  revalidatePath(SETTINGS_PATH);
  return removed ? { success: true } : { success: false, error: "Cihaz bulunamadı veya zaten kaldırılmış" };
}

/**
 * "Diğer oturumları kapat": bumps sessionVersion, which ends every JWT session
 * of the account at its next re-check (≤ 5 minutes) and revokes every trusted
 * device; then re-issues this browser's session so the user stays signed in.
 */
export async function signOutOtherSessionsAction() {
  const session = await requireCustomer();
  const userId = session.user.id;

  const user = await db.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: { sessionVersion: { increment: 1 }, loginTokenNonceHash: null },
      select: { id: true, email: true, sessionVersion: true },
    });
    await revokeAllTrustedDevices(userId, tx);
    return updated;
  });

  (await cookies()).delete(trustedDeviceCookieName(userId));

  try {
    await signIn("credentials", { email: user.email, loginToken: await issueLoginToken(user), redirect: false });
    await recordLoginEvent({
      userId,
      email: user.email,
      success: true,
      method: "reissue",
      sessionVersion: user.sessionVersion,
      detectNewDevice: false,
      ...(await getRequestMeta()),
    });
  } catch (error) {
    console.error("[Security] session re-issue after sign-out-others failed:", error);
    return { success: true, signedOut: true };
  }

  revalidatePath(SETTINGS_PATH);
  return { success: true };
}
