"use server";

import { signIn, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  loginSchema,
  passwordResetRequestSchema,
  passwordResetSchema,
  registerSchema,
} from "@/lib/validations/auth";
import { hash } from "bcryptjs";
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
  const resendApiKey = process.env.RESEND_API_KEY;
  const emailFrom = process.env.EMAIL_FROM || "noreply@kleacore.com";

  if (!resendApiKey) {
    console.info(
      `[PasswordReset][DEV_FALLBACK] ${email} icin sifre sifirlama linki: ${resetUrl}`
    );
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [email],
      subject: "KLEACORE - Şifre Sıfırlama Talebi",
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
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend error: ${response.status} ${body}`);
  }
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

  try {
    await signIn("credentials", {
      email: parsed.data.email,
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

  try {
    const existing = await db.user.findUnique({
      where: { email: parsed.data.email },
    });

    if (existing) {
      return { success: false, error: "Bu e-posta adresi zaten kayıtlı" };
    }

    const hashedPassword = await hash(parsed.data.password, 12);

    await db.user.create({
      data: {
        name: parsed.data.name,
        surname: parsed.data.surname,
        email: parsed.data.email,
        phone: parsed.data.phone ?? null,
        password: hashedPassword,
        role: "CUSTOMER",
        status: "ACTIVE",
      },
    });

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

  try {
    const user = await db.user.findUnique({
      where: { email: parsed.data.email },
    });

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
        data: { password: hashedPassword },
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
