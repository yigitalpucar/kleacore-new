"use server";

import { compare } from "bcryptjs";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { signIn } from "@/lib/auth";
import {
  createTotpSecret,
  decryptTotpSecret,
  encryptBackupCodes,
  encryptTotpSecret,
  generateBackupCodes,
  generateTotpQrDataUrl,
  matchTotpStep,
  serializeBackupCodes,
  verifyBackupCode,
  verifyTwoFactorChallengeToken,
} from "@/lib/auth/two-factor";
import { consumeTotpStep, issueLoginToken } from "@/lib/auth/login-token";
import { isTwoFactorGloballyEnabled } from "@/lib/auth/two-factor-settings";
import { db } from "@/lib/db";
import { checkRateLimit, normalizeRateLimitKey } from "@/lib/rate-limit";
import { requireCustomer } from "@/lib/utils/auth-helpers";
import { cookies } from "next/headers";
import { createTrustedDevice, revokeAllTrustedDevices } from "@/lib/auth/trusted-device";
import { emitEvent } from "@/lib/events/emit";
import { getRequestMeta } from "@/lib/request-meta";
import { recordLoginEvent } from "@/lib/security/login-events";

const totpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Geçerli bir 6 haneli doğrulama kodu girin");

const disableSchema = z.object({
  password: z.string().min(1, "Şifre gerekli"),
  code: z.string().min(1, "Doğrulama kodu gerekli"),
});

export async function enable2FA() {
  const session = await requireCustomer();

  try {
    const globallyEnabled = await isTwoFactorGloballyEnabled();
    if (!globallyEnabled) {
      return {
        success: false,
        error: "İki faktörlü doğrulama sistem yöneticisi tarafından devre dışı bırakılmış.",
      };
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        email: true,
        twoFactorEnabled: true,
      },
    });

    if (!user) {
      return { success: false, error: "Kullanıcı bulunamadı" };
    }

    if (user.twoFactorEnabled) {
      return { success: false, error: "İki faktörlü doğrulama zaten aktif" };
    }

    const secret = createTotpSecret();
    const qrCodeDataUrl = await generateTotpQrDataUrl(secret, user.email);

    await db.user.update({
      where: { id: session.user.id },
      data: {
        twoFactorSecret: encryptTotpSecret(secret),
        twoFactorBackupCodes: null,
        twoFactorEnabled: false,
      },
    });

    return {
      success: true,
      qrCodeDataUrl,
      manualEntryKey: secret,
    };
  } catch {
    return {
      success: false,
      error: "İki faktörlü doğrulama başlatılırken bir hata oluştu",
    };
  }
}

export async function verify2FASetup(formData: FormData) {
  const session = await requireCustomer();

  try {
    const globallyEnabled = await isTwoFactorGloballyEnabled();
    if (!globallyEnabled) {
      return {
        success: false,
        error: "İki faktörlü doğrulama sistem yöneticisi tarafından devre dışı bırakılmış.",
      };
    }

    const parsedCode = totpCodeSchema.safeParse(formData.get("code"));
    if (!parsedCode.success) {
      return {
        success: false,
        error: parsedCode.error.errors[0]?.message ?? "Geçersiz doğrulama kodu",
      };
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        email: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
      },
    });

    if (!user?.twoFactorSecret) {
      return {
        success: false,
        error: "Kurulum bulunamadı. Lütfen yeniden başlatın.",
      };
    }

    if (user.twoFactorEnabled) {
      return { success: false, error: "İki faktörlü doğrulama zaten aktif" };
    }

    const secret = decryptTotpSecret(user.twoFactorSecret);
    const setupStep = secret ? matchTotpStep(secret, user.email, parsedCode.data) : null;
    if (setupStep === null) {
      return { success: false, error: "Doğrulama kodu hatalı" };
    }

    const backupCodes = generateBackupCodes();

    await db.user.update({
      where: { id: session.user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorBackupCodes: serializeBackupCodes(backupCodes),
        twoFactorLastUsedStep: setupStep,
      },
    });

    revalidatePath("/musteri/panel/ayarlar");

    return {
      success: true,
      backupCodes,
    };
  } catch {
    return {
      success: false,
      error: "İki faktörlü doğrulama etkinleştirilirken bir hata oluştu",
    };
  }
}

export async function disable2FA(formData: FormData) {
  const session = await requireCustomer();

  try {
    const parsed = disableSchema.safeParse({
      password: formData.get("password"),
      code: formData.get("code"),
    });

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.errors[0]?.message ?? "Geçersiz bilgiler",
      };
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        email: true,
        password: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        twoFactorBackupCodes: true,
      },
    });

    if (!user?.twoFactorEnabled || !user.twoFactorSecret) {
      return {
        success: false,
        error: "İki faktörlü doğrulama zaten kapalı",
      };
    }

    const passwordValid = await compare(parsed.data.password, user.password);
    if (!passwordValid) {
      return { success: false, error: "Şifre hatalı" };
    }

    const secret = decryptTotpSecret(user.twoFactorSecret);
    const code = parsed.data.code.trim();
    const totpStep = matchTotpStep(secret, user.email, code);
    const totpValid =
      totpStep !== null && (await consumeTotpStep(session.user.id, totpStep));

    let backupResult = { valid: false, remainingCodes: [] as string[] };
    if (!totpValid) {
      backupResult = verifyBackupCode(user.twoFactorBackupCodes, code);
    }

    if (!totpValid && !backupResult.valid) {
      return { success: false, error: "Doğrulama kodu hatalı" };
    }

    // Trusted devices only ever skipped the second factor; without one they
    // are meaningless, and must not come back to life if 2FA is re-enabled.
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: session.user.id },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorBackupCodes: null,
        },
      });
      await revokeAllTrustedDevices(session.user.id, tx);
      await emitEvent(
        tx,
        "user.two_factor_disabled",
        { userId: session.user.id, disabledAt: new Date(), by: "customer" },
        { actorId: session.user.id }
      );
    });

    revalidatePath("/musteri/panel/ayarlar");

    return { success: true };
  } catch {
    return {
      success: false,
      error: "İki faktörlü doğrulama kapatılırken bir hata oluştu",
    };
  }
}

export async function verify2FALogin(formData: FormData) {
  const raw = {
    challengeToken: formData.get("challengeToken") as string,
    code: formData.get("code") as string,
    rememberDevice: formData.get("rememberDevice") === "true",
  };

  if (!raw.challengeToken) {
    return { success: false, error: "Oturum doğrulaması süresi doldu. Lütfen tekrar giriş yapın." };
  }

  const challenge = verifyTwoFactorChallengeToken(raw.challengeToken);
  if (!challenge) {
    return { success: false, error: "Oturum doğrulaması süresi doldu. Lütfen tekrar giriş yapın." };
  }

  const verifyLimit = await checkRateLimit({
    key: `2fa-login:${normalizeRateLimitKey(challenge.email)}`,
    limit: 8,
    windowMs: 15 * 60 * 1000,
  });

  if (!verifyLimit.allowed) {
    return {
      success: false,
      error: "Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin.",
    };
  }

  const code = raw.code?.trim() ?? "";
  if (!code) {
    return { success: false, error: "Doğrulama kodu gerekli" };
  }

  try {
    const globallyEnabled = await isTwoFactorGloballyEnabled();
    if (!globallyEnabled) {
      return {
        success: false,
        error: "İki faktörlü doğrulama şu anda devre dışı.",
      };
    }

    const user = await db.user.findUnique({
      where: { id: challenge.userId },
      select: {
        id: true,
        email: true,
        status: true,
        sessionVersion: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        twoFactorBackupCodes: true,
      },
    });

    if (
      !user ||
      user.email !== challenge.email ||
      user.status !== "ACTIVE" ||
      !user.twoFactorEnabled ||
      !user.twoFactorSecret
    ) {
      return { success: false, error: "Geçersiz doğrulama oturumu" };
    }

    const secret = decryptTotpSecret(user.twoFactorSecret);
    // A code is accepted once: replaying it inside its 30s window fails.
    const totpStep = matchTotpStep(secret, user.email, code);
    const totpValid = totpStep !== null && (await consumeTotpStep(user.id, totpStep));

    let backupResult = { valid: false, remainingCodes: [] as string[] };
    if (!totpValid) {
      backupResult = verifyBackupCode(user.twoFactorBackupCodes, code);
    }

    const requestMeta = await getRequestMeta();

    if (!totpValid && !backupResult.valid) {
      await recordLoginEvent({
        userId: user.id,
        email: user.email,
        success: false,
        reason: "bad_2fa",
        method: "two_factor",
        ...requestMeta,
      });
      return { success: false, error: "Doğrulama kodu hatalı" };
    }

    if (backupResult.valid) {
      await db.user.update({
        where: { id: user.id },
        data: {
          twoFactorBackupCodes: encryptBackupCodes(backupResult.remainingCodes),
        },
      });
    }

    // The pending challenge token is never a login credential; mint a
    // separate single-use token that the credentials provider will accept.
    const loginToken = await issueLoginToken(user);

    try {
      await signIn("credentials", {
        email: user.email,
        loginToken,
        redirect: false,
      });
    } catch (err) {
      if (err instanceof AuthError) {
        return { success: false, error: "Giriş sırasında bir hata oluştu" };
      }
      throw err;
    }

    await recordLoginEvent({
      userId: user.id,
      email: user.email,
      success: true,
      method: "two_factor",
      twoFactorUsed: true,
      sessionVersion: user.sessionVersion,
      ...requestMeta,
    });

    if (raw.rememberDevice) {
      try {
        const device = await createTrustedDevice(user, requestMeta);
        (await cookies()).set(device.cookieName, device.cookieValue, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          expires: device.expiresAt,
        });
      } catch (error) {
        // Signed in already; only the "remember" convenience is lost.
        console.error("[2FA] trusted device could not be stored:", error);
      }
    }

    return { success: true };
  } catch {
    return { success: false, error: "Doğrulama sırasında bir hata oluştu" };
  }
}

