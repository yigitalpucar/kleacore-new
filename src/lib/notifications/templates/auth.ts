import { z } from "zod";
import { dateField, dateTime, panelPaths, templateSchema } from "./helpers";
import { defineTemplate } from "./types";

/** Signup: welcome + email verification link (used by the signup flow). */
export const authVerifyEmail = defineTemplate({
  key: "auth.verify-email",
  label: "Hoş geldiniz + e-posta doğrulama",
  group: "Hesap",
  audience: "customer",
  schema: templateSchema({
    verifyUrl: z.string().url(),
    expiresInHours: z.number().int().positive().optional(),
  }),
  sensitive: ["verifyUrl"],
  sample: { recipientName: "Ayşe Yılmaz", verifyUrl: "https://kleacore.com/musteri/dogrula?token=ornek", expiresInHours: 24 },
  render: (data, { brand }) => ({
    subject: `${brand.siteName}'a hoş geldiniz — e-posta adresinizi doğrulayın`,
    heading: "Hoş geldiniz!",
    greetingName: data.recipientName,
    intro: [
      `${brand.siteName} hesabınız oluşturuldu. Hesabınızı kullanmaya başlamak için e-posta adresinizi doğrulayın.`,
    ],
    action: { label: "E-postamı doğrula", url: data.verifyUrl },
    outro: data.expiresInHours
      ? [`Bu bağlantı ${data.expiresInHours} saat boyunca geçerlidir.`]
      : [],
    note: "Bu hesabı siz oluşturmadıysanız bu e-postayı yok sayabilirsiniz; adresiniz doğrulanmadan hesap kullanılamaz.",
  }),
});

export const authPasswordReset = defineTemplate({
  key: "auth.password-reset",
  label: "Şifre sıfırlama bağlantısı",
  group: "Hesap",
  audience: "customer",
  schema: templateSchema({
    resetUrl: z.string().url(),
    ttlMinutes: z.number().int().positive(),
  }),
  sensitive: ["resetUrl"],
  sample: { recipientName: "Ayşe Yılmaz", resetUrl: "https://kleacore.com/musteri/sifre-sifirla?token=ornek", ttlMinutes: 30 },
  render: (data, { brand }) => ({
    subject: `${brand.siteName} — Şifre sıfırlama talebi`,
    heading: "Şifre sıfırlama talebi",
    greetingName: data.recipientName,
    intro: ["Hesabınız için şifre sıfırlama isteği aldık. Yeni şifrenizi belirlemek için aşağıdaki butonu kullanın."],
    action: { label: "Şifremi sıfırla", url: data.resetUrl },
    outro: [`Bu bağlantı ${data.ttlMinutes} dakika boyunca geçerlidir ve yalnızca bir kez kullanılabilir.`],
    note: "Bu işlemi siz başlatmadıysanız bu e-postayı yok sayabilirsiniz; şifreniz değişmeyecektir.",
  }),
});

export const authPasswordChanged = defineTemplate({
  key: "auth.password-changed",
  label: "Şifre değişti",
  group: "Hesap",
  audience: "customer",
  inbox: "SYSTEM",
  schema: templateSchema({
    changedAt: dateField,
    method: z.enum(["reset", "profile", "admin"]).optional(),
  }),
  sample: { recipientName: "Ayşe Yılmaz", changedAt: "2026-10-08T10:15:00.000Z", method: "profile" },
  render: (data, { baseUrl, brand }) => ({
    subject: "Şifreniz değiştirildi",
    heading: "Şifreniz değiştirildi",
    greetingName: data.recipientName,
    intro: [
      `${brand.siteName} hesabınızın şifresi ${dateTime(data.changedAt)} tarihinde değiştirildi. Güvenliğiniz için diğer cihazlardaki oturumlar kapatıldı.`,
    ],
    action: { label: "Hesap güvenliği", url: `${baseUrl}${panelPaths.security}` },
    note: `Bu değişikliği siz yapmadıysanız hemen "Şifremi unuttum" ile yeni şifre belirleyin ve ${brand.supportEmail} adresine yazın.`,
  }),
  sms: (data, { brand }) =>
    `${brand.siteName}: Hesap şifreniz ${dateTime(data.changedAt)} tarihinde değiştirildi. Siz yapmadıysanız destek ile iletişime geçin.`,
});

/**
 * Customer created by the infrastructure import (2.7) without a password:
 * the link sets the first password (a PasswordResetToken with a longer TTL).
 */
export const accountInvite = defineTemplate({
  key: "account.invite",
  label: "Hesap daveti (içe aktarılan müşteri)",
  group: "Hesap",
  audience: "customer",
  schema: templateSchema({
    inviteUrl: z.string().url(),
    expiresInDays: z.number().int().positive(),
    /** e.g. "2 hizmet, 1 alan adı" */
    summary: z.string().optional(),
  }),
  sensitive: ["inviteUrl"],
  sample: {
    recipientName: "Ayşe Yılmaz",
    inviteUrl: "https://kleacore.com/musteri/sifre-sifirla?token=ornek",
    expiresInDays: 7,
    summary: "1 hosting hizmeti",
  },
  render: (data, { brand }) => ({
    subject: `${brand.siteName} müşteri panelinize davetlisiniz`,
    heading: "Müşteri paneliniz hazır",
    greetingName: data.recipientName,
    intro: [
      `Mevcut hizmetleriniz${data.summary ? ` (${data.summary})` : ""} ${brand.siteName} müşteri paneline taşındı. Hizmetlerinizde bir değişiklik yapılmadı.`,
      "Panele giriş yapabilmek için aşağıdaki butondan şifrenizi belirleyin.",
    ],
    action: { label: "Şifremi belirle", url: data.inviteUrl },
    outro: [`Bu bağlantı ${data.expiresInDays} gün boyunca geçerlidir ve yalnızca bir kez kullanılabilir. Süresi dolarsa giriş sayfasındaki "Şifremi unuttum" ile yeni bağlantı isteyebilirsiniz.`],
    note: `Bu e-postayı beklemiyorsanız ${brand.supportEmail} adresine yazın.`,
  }),
});
