"use server";

import { cookies } from "next/headers";
import { auth, signIn, signOut } from "@/lib/auth";
import { findUserByEmail } from "@/lib/auth/email";
import { createLoginTwoFactorChallenge } from "@/lib/auth/two-factor-settings";
import { AFFILIATE_REF_COOKIE } from "@/lib/affiliate";
import { isEmailVerified, sendVerificationEmail } from "@/lib/auth/email-verification";
import { registerCustomerAccount } from "@/lib/auth/registration";
import { db } from "@/lib/db";
import {
  loginSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  registerSchema,
} from "@/lib/validations/auth";
import { emitEventAfterCommit } from "@/lib/events/emit";
import { sendNotification } from "@/lib/notifications/send";
import { checkRateLimit, normalizeRateLimitKey } from "@/lib/rate-limit";
import { compare, hash } from "bcryptjs";
import { AuthError } from "next-auth";
import { createHash, randomBytes } from "node:crypto";
import {
  LOGIN_CAPTCHA_ACTION,
  clearFailedLogins,
  createLoginCaptchaProof,
  isLoginCaptchaRequired,
  recordFailedLogin,
} from "@/lib/auth/login-captcha";
import {
  TURNSTILE_ERROR_MESSAGE,
  readTurnstileToken,
  verifyTurnstileToken,
} from "@/lib/security/turnstile";
import { getRequestMeta } from "@/lib/request-meta";

const PASSWORD_RESET_TTL_MINUTES = 30;

function getAppBaseUrl() {
  return (
    process.env.APP_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

function buildPasswordResetUrl(token: string) {
  const baseUrl = getAppBaseUrl();
  return `${baseUrl}/musteri/sifre-sifirla?token=${encodeURIComponent(token)}`;
}

async function sendPasswordResetEmail(userId: string, resetUrl: string) {
  // Queued via the notification system; the link is encrypted in the queue
  // payload and NotificationLog (sensitive field), never logged in clear.
  await sendNotification({
    userId,
    template: "auth.password-reset",
    data: { resetUrl, ttlMinutes: PASSWORD_RESET_TTL_MINUTES },
    channel: "EMAIL",
  });
}

export async function loginAction(formData: FormData) {
  const raw = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Geçersiz giriş bilgileri",
    };
  }

  const loginLimit = await checkRateLimit({
    key: `login:${normalizeRateLimitKey(parsed.data.email)}`,
    limit: 8,
    windowMs: 15 * 60 * 1000,
  });
  if (!loginLimit.allowed) {
    return { success: false, error: "Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin." };
  }

  const { ip } = await getRequestMeta();
  const email = parsed.data.email;

  if (await isLoginCaptchaRequired(email, ip)) {
    const token = readTurnstileToken(formData);
    const captcha = await verifyTurnstileToken(token, {
      remoteIp: ip,
      action: LOGIN_CAPTCHA_ACTION,
    });
    if (!captcha.success) {
      return {
        success: false,
        requiresCaptcha: true,
        error: token
          ? TURNSTILE_ERROR_MESSAGE
          : "Çok sayıda hatalı deneme yapıldı. Devam etmek için güvenlik doğrulamasını tamamlayın.",
      };
    }
  }

  const failedLogin = async () => {
    await recordFailedLogin(email, ip);
    return {
      success: false,
      error: "E-posta veya şifre hatalı",
      requiresCaptcha: await isLoginCaptchaRequired(email, ip),
    };
  };

  try {
    const user = await findUserByEmail(email);

    if (!user || user.status !== "ACTIVE") {
      return await failedLogin();
    }

    const passwordValid = await compare(parsed.data.password, user.password);
    if (!passwordValid) {
      return await failedLogin();
    }
    await clearFailedLogins(email);

    const challengeToken = await createLoginTwoFactorChallenge(
      user.email,
      user.id
    );

    if (challengeToken) {
      return {
        success: false,
        requires2FA: true,
        challengeToken,
      };
    }

    await signIn("credentials", {
      email: user.email,
      password: parsed.data.password,
      // This action already enforced the captcha policy; the proof keeps the
      // provider from asking for the (single-use) Turnstile token again.
      captchaProof: createLoginCaptchaProof(user.email),
      redirect: false,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      switch (err.type) {
        case "CredentialsSignin":
          return { success: false, error: "E-posta veya şifre hatalı" };
        default:
          return { success: false, error: "Giriş sırasında bir hata oluştu" };
      }
    }
    throw err;
  }

  return { success: true };
}

export async function registerAction(formData: FormData) {
  const raw = {
    name: formData.get("name") as string,
    surname: formData.get("surname") as string,
    email: formData.get("email") as string,
    phone: (formData.get("phone") as string) || undefined,
    password: formData.get("password") as string,
    confirmPassword: formData.get("confirmPassword") as string,
  };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Geçersiz bilgiler",
    };
  }

  const registerLimit = await checkRateLimit({
    key: `register:${normalizeRateLimitKey(parsed.data.email)}`,
    limit: 4,
    windowMs: 60 * 60 * 1000,
  });
  if (!registerLimit.allowed) {
    return { success: false, error: "Çok fazla kayıt denemesi yapıldı. Lütfen daha sonra tekrar deneyin." };
  }

  const cookieStore = await cookies();
  const { ip, userAgent } = await getRequestMeta();
  const result = await registerCustomerAccount({
    name: parsed.data.name,
    surname: parsed.data.surname,
    email: parsed.data.email,
    phone: parsed.data.phone ?? null,
    password: parsed.data.password,
    kvkkAccepted: formData.get("kvkkAccepted") === "true",
    turnstileToken: readTurnstileToken(formData),
    refCode: cookieStore.get(AFFILIATE_REF_COOKIE)?.value,
    ipAddress: ip,
    userAgent,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  cookieStore.delete(AFFILIATE_REF_COOKIE);
  return { success: true };
}

/** Sends a fresh verification link to the signed-in, still unverified user. */
export async function resendVerificationEmailAction() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return { success: false, error: "Oturumunuz sona erdi. Lütfen tekrar giriş yapın." };
  }

  if (await isEmailVerified(userId)) {
    return { success: true, alreadyVerified: true };
  }

  const limit = await checkRateLimit({
    key: `verify-email-resend:${userId}`,
    limit: 3,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.allowed) {
    return {
      success: false,
      error: "Çok fazla doğrulama e-postası istendi. Lütfen bir süre sonra tekrar deneyin.",
    };
  }

  const sent = await sendVerificationEmail(userId);
  if (!sent.sent) {
    return { success: false, error: "Doğrulama e-postası gönderilemedi. Lütfen daha sonra tekrar deneyin." };
  }
  return { success: true };
}

export async function logoutAction() {
  try {
    await signOut({ redirect: false });
    return { success: true };
  } catch {
    return { success: false, error: "Çıkış sırasında bir hata oluştu" };
  }
}

export async function requestPasswordReset(formData: FormData) {
  const raw = {
    email: formData.get("email") as string,
  };

  const parsed = passwordResetRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: "Gecerli bir e-posta adresi girin" };
  }

  const { ip } = await getRequestMeta();
  const captcha = await verifyTurnstileToken(readTurnstileToken(formData), {
    remoteIp: ip,
    action: "password-reset",
  });
  if (!captcha.success) {
    return { success: false, error: TURNSTILE_ERROR_MESSAGE };
  }

  const resetLimit = await checkRateLimit({
    key: `password-reset:${normalizeRateLimitKey(parsed.data.email)}`,
    limit: 3,
    windowMs: 60 * 60 * 1000,
  });
  if (!resetLimit.allowed) {
    return { success: true };
  }

  try {
    const user = await findUserByEmail(parsed.data.email);

    // Güvenlik: Kullanıcı bulunamasa bile aynı mesajı göster
    if (!user) {
      return { success: true };
    }

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);

    await db.$transaction([
      db.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      }),
      db.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      }),
    ]);

    const resetUrl = buildPasswordResetUrl(rawToken);

    try {
      await sendPasswordResetEmail(user.id, resetUrl);
    } catch (error) {
      console.error("[PasswordReset] email send error:", error);
    }

    if (process.env.NODE_ENV !== "production") {
      return { success: true, debugResetUrl: resetUrl };
    }

    return { success: true };
  } catch (error) {
    console.error("[PasswordReset] request error:", error);
    return { success: false, error: "İşlem sırasında bir hata oluştu" };
  }
}

export async function resetPasswordAction(formData: FormData) {
  const raw = {
    token: formData.get("token") as string,
    password: formData.get("password") as string,
    confirmPassword: formData.get("confirmPassword") as string,
  };

  const parsed = passwordResetSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Geçersiz bilgiler",
    };
  }

  try {
    const tokenHash = createHash("sha256")
      .update(parsed.data.token)
      .digest("hex");

    const resetToken = await db.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true } } },
    });

    if (
      !resetToken ||
      resetToken.usedAt ||
      resetToken.expiresAt.getTime() < Date.now()
    ) {
      return {
        success: false,
        error: "Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş",
      };
    }

    const hashedPassword = await hash(parsed.data.password, 12);

    await db.$transaction([
      db.user.update({
        where: { id: resetToken.userId },
        // Bumping sessionVersion revokes every session issued before the reset.
        data: {
          password: hashedPassword,
          sessionVersion: { increment: 1 },
          loginTokenNonceHash: null,
        },
      }),
      db.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      db.passwordResetToken.deleteMany({
        where: {
          userId: resetToken.userId,
          usedAt: null,
          id: { not: resetToken.id },
        },
      }),
    ]);

    await emitEventAfterCommit(
      "user.password_changed",
      { userId: resetToken.userId, changedAt: new Date(), method: "reset" },
      { actorId: resetToken.userId }
    );

    return { success: true };
  } catch (error) {
    console.error("[PasswordReset] reset error:", error);
    return { success: false, error: "Şifre sıfırlanırken bir hata oluştu" };
  }
}
