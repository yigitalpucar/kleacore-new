import { z } from "zod";
import { dateField, dateTime, panelPaths, templateSchema } from "./helpers";
import { defineTemplate } from "./types";

const securityAction = (baseUrl: string) => ({ label: "Hesap güvenliği", url: `${baseUrl}${panelPaths.security}?sekme=guvenlik` });

export const securityNewDeviceLogin = defineTemplate({
  key: "security.new-device-login",
  label: "Yeni cihazdan giriş",
  group: "Güvenlik",
  audience: "customer",
  inbox: "SYSTEM",
  schema: templateSchema({
    device: z.string(),
    ipAddress: z.string().optional(),
    network: z.string().optional(),
    occurredAt: dateField,
    twoFactorUsed: z.boolean().optional(),
  }),
  sample: {
    recipientName: "Ayşe Yılmaz",
    device: "Chrome · Windows",
    ipAddress: "203.0.113.24",
    network: "TR",
    occurredAt: "2026-10-09T08:42:00.000Z",
    twoFactorUsed: false,
  },
  render: (data, { baseUrl, brand }) => ({
    subject: `${brand.siteName} hesabınıza yeni bir cihazdan giriş yapıldı`,
    heading: "Yeni cihazdan giriş",
    greetingName: data.recipientName,
    intro: [`Hesabınıza daha önce kullanmadığınız bir cihaz veya ağdan giriş yapıldı.`],
    details: [
      { label: "Zaman", value: dateTime(data.occurredAt) },
      { label: "Cihaz", value: data.device },
      ...(data.ipAddress ? [{ label: "IP adresi", value: data.ipAddress, mono: true }] : []),
      ...(data.network ? [{ label: "Konum / ağ", value: data.network, mono: true }] : []),
      { label: "İki faktörlü doğrulama", value: data.twoFactorUsed ? "Kullanıldı" : "Kullanılmadı" },
    ],
    action: securityAction(baseUrl),
    outro: ["Bu giriş size aitse herhangi bir işlem yapmanız gerekmez."],
    note: `Giriş size ait değilse hemen şifrenizi değiştirin, "Diğer oturumları kapat" seçeneğini kullanın ve ${brand.supportEmail} adresine yazın.`,
  }),
  sms: (data, { brand }) =>
    `${brand.siteName}: Hesabınıza ${dateTime(data.occurredAt)} tarihinde yeni bir cihazdan (${data.device}) giriş yapıldı. Siz değilseniz şifrenizi değiştirin.`,
});

export const securityFailedLoginBurst = defineTemplate({
  key: "security.failed-login-burst",
  label: "Çok sayıda başarısız giriş denemesi",
  group: "Güvenlik",
  audience: "customer",
  inbox: "SYSTEM",
  schema: templateSchema({
    failedAttempts: z.number().int().positive(),
    windowMinutes: z.number().int().positive(),
    lastIpAddress: z.string().optional(),
    lastAttemptAt: dateField,
  }),
  sample: {
    recipientName: "Ayşe Yılmaz",
    failedAttempts: 6,
    windowMinutes: 60,
    lastIpAddress: "198.51.100.7",
    lastAttemptAt: "2026-10-09T03:12:00.000Z",
  },
  render: (data, { baseUrl, brand }) => ({
    subject: `${brand.siteName} hesabınızda başarısız giriş denemeleri`,
    heading: "Başarısız giriş denemeleri",
    greetingName: data.recipientName,
    intro: [
      `Son ${data.windowMinutes} dakika içinde hesabınıza ${data.failedAttempts} kez hatalı şifreyle veya hatalı doğrulama koduyla giriş denendi.`,
    ],
    details: [
      { label: "Son deneme", value: dateTime(data.lastAttemptAt) },
      ...(data.lastIpAddress ? [{ label: "Son deneme IP", value: data.lastIpAddress, mono: true }] : []),
    ],
    action: securityAction(baseUrl),
    outro: [
      "Denemeleri siz yaptıysanız bir işlem yapmanız gerekmez. Değilse güçlü ve benzersiz bir şifre kullandığınızdan emin olun ve iki faktörlü doğrulamayı açın.",
    ],
    note: "Bu bildirim en fazla saatte bir gönderilir.",
  }),
});

export const authTwoFactorDisabled = defineTemplate({
  key: "auth.two-factor-disabled",
  label: "İki faktörlü doğrulama kapatıldı",
  group: "Hesap",
  audience: "customer",
  inbox: "SYSTEM",
  schema: templateSchema({ disabledAt: dateField, by: z.enum(["customer", "admin"]).optional() }),
  sample: { recipientName: "Ayşe Yılmaz", disabledAt: "2026-10-09T10:15:00.000Z", by: "customer" },
  render: (data, { baseUrl, brand }) => ({
    subject: "İki faktörlü doğrulama kapatıldı",
    heading: "İki faktörlü doğrulama kapatıldı",
    greetingName: data.recipientName,
    intro: [
      `${brand.siteName} hesabınızda iki faktörlü doğrulama ${dateTime(data.disabledAt)} tarihinde ${data.by === "admin" ? "yönetici tarafından " : ""}kapatıldı. Hatırlanan cihazlarınızın tümü de kaldırıldı.`,
    ],
    action: securityAction(baseUrl),
    note: `Bu değişikliği siz yapmadıysanız hemen şifrenizi değiştirin ve ${brand.supportEmail} adresine yazın.`,
  }),
  sms: (data, { brand }) =>
    `${brand.siteName}: Hesabınızda iki faktörlü doğrulama ${dateTime(data.disabledAt)} tarihinde kapatıldı. Siz yapmadıysanız destek ile iletişime geçin.`,
});

/** Sent to the OLD address, so a hijacked account's owner learns about it. */
export const authEmailChanged = defineTemplate({
  key: "auth.email-changed",
  label: "E-posta adresi değişti (eski adrese)",
  group: "Hesap",
  audience: "customer",
  schema: templateSchema({ oldEmail: z.string().email(), newEmail: z.string().email(), changedAt: dateField }),
  sample: {
    recipientName: "Ayşe Yılmaz",
    oldEmail: "ayse@example.com",
    newEmail: "ayse.yilmaz@example.com",
    changedAt: "2026-10-09T10:15:00.000Z",
  },
  render: (data, { brand }) => ({
    subject: `${brand.siteName} hesabınızın e-posta adresi değiştirildi`,
    heading: "E-posta adresiniz değiştirildi",
    greetingName: data.recipientName,
    intro: [
      `${brand.siteName} hesabınızın giriş e-postası ${dateTime(data.changedAt)} tarihinde değiştirildi. Bundan sonra bildirimler yeni adrese gönderilecek.`,
    ],
    details: [
      { label: "Eski adres", value: data.oldEmail, mono: true },
      { label: "Yeni adres", value: data.newEmail, mono: true },
    ],
    note: `Bu değişikliği siz yapmadıysanız hemen ${brand.supportEmail} adresine yazın.`,
  }),
});
