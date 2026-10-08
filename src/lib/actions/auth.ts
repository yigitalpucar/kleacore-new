"use server";

import { cookies } from "next/headers";
import { signIn, signOut } from "@/lib/auth";
import { findUserByEmail } from "@/lib/auth/email";
import { createLoginTwoFactorChallenge } from "@/lib/auth/two-factor-settings";
import {
  AFFILIATE_REF_COOKIE,
  createCustomerUser,
} from "@/lib/affiliate";
import { db } from "@/lib/db";
import {
  loginSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  registerSchema,
} from "@/lib/validations/auth";
import { sendTransactionalEmail } from "@/lib/mail";
import { checkRateLimit, normalizeRateLimitKey } from "@/lib/rate-limit";
import { compare, hash } from "bcryptjs";
import { AuthError } from "next-auth";
import { createHash, randomBytes } from "node:crypto";

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

async function sendPasswordResetEmail(email: string, resetUrl: string) {
  await sendTransactionalEmail({
    to: email,
    subject: "KLEACORE - Şifre Sıfırlama Talebi",
    text: [
      "Şifre sıfırlama talebi aldık.",
      `Bağlantı: ${resetUrl}`,
      `Bu bağlantı ${PASSWORD_RESET_TTL_MINUTES} dakika boyunca geçerlidir.`,
      "Eğer bu işlemi siz başlatmadıysanız bu e-postayı yok sayabilirsiniz.",
    ].join("\n"),
    html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
          <h2>Şifre Sıfırlama Talebi</h2>
          <p>Hesabınız için şifre sıfırlama isteği aldık.</p>
          <p>
            <a href="${resetUrl}" style="display:inline-block;padding:10px 14px;background:#111827;color:#fff;text-decoration:none;border-radius:8px">
              Şifremi Sıfırla
            </a>
          </p>
          <p>Bu bağlantı ${PASSWORD_RESET_TTL_MINUTES} dakika boyunca geçerlidir.</p>
          <p>Eğer bu işlemi siz başlatmadıysanız bu e-postayı yok sayabilirsiniz.</p>
        </div>
      `,
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

  try {
    const user = await findUserByEmail(parsed.data.email);

    if (!user || user.status !== "ACTIVE") {
      return { success: false, error: "E-posta veya şifre hatalı" };
    }

    const passwordValid = await compare(parsed.data.password, user.password);
    if (!passwordValid) {
      return { success: false, error: "E-posta veya şifre hatalı" };
    }

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

  try {
    const existing = await findUserByEmail(parsed.data.email);

    if (existing) {
      return { success: false, error: "Bu e-posta adresi zaten kayıtlı" };
    }

    const hashedPassword = await hash(parsed.data.password, 12);
    const cookieStore = await cookies();
    const refCode = cookieStore.get(AFFILIATE_REF_COOKIE)?.value;

    await db.$transaction(async (tx) => {
      await createCustomerUser(
        tx,
        {
          name: parsed.data.name,
          surname: parsed.data.surname,
          email: parsed.data.email,
          phone: parsed.data.phone ?? null,
          password: hashedPassword,
        },
        refCode
      );
    });

    cookieStore.delete(AFFILIATE_REF_COOKIE);

    return { success: true };
  } catch {
    return { success: false, error: "Kayıt sırasında bir hata oluştu" };
  }
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
      await sendPasswordResetEmail(user.email, resetUrl);
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

    return { success: true };
  } catch (error) {
    console.error("[PasswordReset] reset error:", error);
    return { success: false, error: "Şifre sıfırlanırken bir hata oluştu" };
  }
}
