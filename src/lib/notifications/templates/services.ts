import { z } from "zod";
import { date, dateField, panelPaths, templateSchema } from "./helpers";
import { defineTemplate, type EmailDetail } from "./types";

const serviceShape = {
  serviceId: z.string(),
  serviceLabel: z.string(),
};

const serviceSample = {
  recipientName: "Ayşe Yılmaz",
  serviceId: "ornek",
  serviceLabel: "Linux Hosting Başlangıç — ornek.com",
};

export const serviceSuspended = defineTemplate({
  key: "service.suspended",
  label: "Hizmet askıya alındı",
  group: "Hizmet",
  audience: "customer",
  inbox: "SERVICE",
  schema: templateSchema({ ...serviceShape, reason: z.string(), suspendedAt: dateField }),
  sample: { ...serviceSample, reason: "Ödenmemiş fatura", suspendedAt: "2026-10-08T10:15:00.000Z" },
  render: (data, { baseUrl }) => ({
    subject: `Hizmetiniz askıya alındı: ${data.serviceLabel}`,
    heading: "Hizmetiniz askıya alındı",
    greetingName: data.recipientName,
    intro: [`${data.serviceLabel} hizmetiniz askıya alındı.`],
    details: [
      { label: "Hizmet", value: data.serviceLabel },
      { label: "Sebep", value: data.reason },
      { label: "Tarih", value: date(data.suspendedAt) },
    ],
    action: { label: "Hizmeti görüntüle", url: `${baseUrl}${panelPaths.service(data.serviceId)}` },
    outro: ["Askı ödenmemiş bir faturadan kaynaklanıyorsa ödeme yapıldığında hizmetiniz otomatik olarak yeniden açılır."],
  }),
  sms: (data, { brand }) => `${brand.siteName}: ${data.serviceLabel} hizmetiniz askıya alındı. Detaylar müşteri panelinizde.`,
});

export const serviceUnsuspended = defineTemplate({
  key: "service.unsuspended",
  label: "Hizmet tekrar aktif",
  group: "Hizmet",
  audience: "customer",
  inbox: "SERVICE",
  schema: templateSchema(serviceShape),
  sample: serviceSample,
  render: (data, { baseUrl }) => ({
    subject: `Hizmetiniz yeniden aktif: ${data.serviceLabel}`,
    heading: "Hizmetiniz yeniden aktif",
    greetingName: data.recipientName,
    intro: [`${data.serviceLabel} hizmetiniz yeniden aktifleştirildi. Kesintisiz kullanmaya devam edebilirsiniz.`],
    action: { label: "Hizmeti görüntüle", url: `${baseUrl}${panelPaths.service(data.serviceId)}` },
  }),
});

/**
 * "Hizmet aktif + giriş bilgileri". Hosting: cPanel user + panel URL +
 * nameservers. Server (VDS/VPS): IP, hostname, user and either the initial
 * password (encrypted at rest, redacted in logs/inbox) or a note that it is
 * delivered separately.
 */
export const serviceActivated = defineTemplate({
  key: "service.activated",
  label: "Hizmet aktif + giriş bilgileri",
  group: "Hizmet",
  audience: "customer",
  inbox: "SERVICE",
  schema: templateSchema({
    ...serviceShape,
    kind: z.enum(["hosting", "server", "other"]),
    domain: z.string().optional(),
    username: z.string().optional(),
    panelUrl: z.string().optional(),
    nameservers: z.array(z.string()).optional(),
    ipAddress: z.string().optional(),
    hostname: z.string().optional(),
    password: z.string().optional(),
    passwordDelivery: z.enum(["included", "separately", "panel"]).optional(),
    notes: z.string().optional(),
  }),
  sensitive: ["password"],
  sample: {
    recipientName: "Ayşe Yılmaz",
    serviceId: "ornek",
    serviceLabel: "VDS Pro 8 GB",
    kind: "server",
    ipAddress: "203.0.113.10",
    hostname: "vds-ornek.kleacore.com",
    username: "root",
    password: "Ornek-Sifre-123",
    passwordDelivery: "included",
    notes: "Ubuntu 24.04 LTS kuruldu.",
  },
  render: (data, { baseUrl, brand }) => {
    const details: EmailDetail[] = [{ label: "Hizmet", value: data.serviceLabel }];
    if (data.domain) details.push({ label: "Alan adı", value: data.domain, mono: true });
    if (data.ipAddress) details.push({ label: "IP adresi", value: data.ipAddress, mono: true });
    if (data.hostname) details.push({ label: "Sunucu adı", value: data.hostname, mono: true });
    if (data.panelUrl) details.push({ label: "Kontrol paneli", value: data.panelUrl, mono: true });
    if (data.username) {
      details.push({ label: data.kind === "hosting" ? "cPanel kullanıcı adı" : "Kullanıcı adı", value: data.username, mono: true });
    }
    if (data.password && data.passwordDelivery !== "separately") {
      details.push({ label: "İlk şifre", value: data.password, mono: true });
    }
    data.nameservers?.forEach((ns, index) => details.push({ label: `Ad sunucusu ${index + 1}`, value: ns, mono: true }));

    const passwordLine =
      data.passwordDelivery === "separately"
        ? "Giriş şifreniz güvenliğiniz için size ayrıca iletilecektir."
        : data.password
          ? "Güvenliğiniz için ilk girişte şifrenizi değiştirin ve bu e-postayı saklamayın."
          : data.kind === "hosting"
            ? "Kontrol paneli şifrenizi müşteri panelinizden veya destek talebiyle sıfırlayabilirsiniz."
            : data.passwordDelivery === "panel"
              ? "İlk giriş şifrenizi müşteri panelinde hizmet sayfasından bir kez görüntüleyebilirsiniz; ilk girişte değiştirin."
              : null;

    return {
      subject: `Hizmetiniz aktif: ${data.serviceLabel}`,
      heading: "Hizmetiniz kullanıma hazır",
      greetingName: data.recipientName,
      intro: [
        `${data.serviceLabel} hizmetiniz kuruldu ve aktifleştirildi. Giriş bilgileriniz aşağıdadır.`,
        ...(data.kind === "hosting" && data.nameservers?.length
          ? ["Alan adınızın ad sunucularını (nameserver) aşağıdaki değerlere yönlendirdiğinizde siteniz yayına girer; yayılım 24 saate kadar sürebilir."]
          : []),
      ],
      details,
      action: { label: "Hizmeti görüntüle", url: `${baseUrl}${panelPaths.service(data.serviceId)}` },
      outro: [...(data.notes ? [data.notes] : []), ...(passwordLine ? [passwordLine] : [])],
      note: `Sorularınız için ${brand.supportEmail} adresine yazabilir veya panelden destek talebi açabilirsiniz.`,
    };
  },
  sms: (data, { brand }) => `${brand.siteName}: ${data.serviceLabel} hizmetiniz aktif. Giriş bilgileri e-posta adresinize gönderildi.`,
});

export const serviceCancellationReceived = defineTemplate({
  key: "service.cancellation-received",
  label: "İptal talebi alındı",
  group: "Hizmet",
  audience: "customer",
  inbox: "SERVICE",
  schema: templateSchema({ ...serviceShape, reason: z.string() }),
  sample: { ...serviceSample, reason: "Projeyi başka bir altyapıya taşıdık." },
  render: (data, { baseUrl }) => ({
    subject: `İptal talebiniz alındı: ${data.serviceLabel}`,
    heading: "İptal talebiniz alındı",
    greetingName: data.recipientName,
    intro: [`${data.serviceLabel} hizmetiniz için iptal talebinizi aldık. Talebiniz incelendikten sonra size bilgi vereceğiz.`],
    details: [
      { label: "Hizmet", value: data.serviceLabel },
      { label: "İptal nedeni", value: data.reason },
    ],
    action: { label: "Hizmeti görüntüle", url: `${baseUrl}${panelPaths.service(data.serviceId)}` },
    note: "Onaylanana kadar hizmetiniz çalışmaya devam eder.",
  }),
});

export const serviceCancellationApproved = defineTemplate({
  key: "service.cancellation-approved",
  label: "İptal talebi onaylandı",
  group: "Hizmet",
  audience: "customer",
  inbox: "SERVICE",
  schema: templateSchema({ ...serviceShape, cancelledAt: dateField }),
  sample: { ...serviceSample, cancelledAt: "2026-10-08T10:15:00.000Z" },
  render: (data, { baseUrl }) => ({
    subject: `İptal talebiniz onaylandı: ${data.serviceLabel}`,
    heading: "İptal talebiniz onaylandı",
    greetingName: data.recipientName,
    intro: [`${data.serviceLabel} hizmetiniz ${date(data.cancelledAt)} tarihi itibarıyla iptal edildi.`],
    action: { label: "Hizmetlerim", url: `${baseUrl}${panelPaths.services}` },
    note: "Verilerinizi henüz yedeklemediyseniz kalıcı silinmeden önce destek ekibimize yazın.",
  }),
});

export const sslExpiryNotice = defineTemplate({
  key: "ssl.expiry-notice",
  label: "SSL süre uyarısı",
  group: "Hizmet",
  audience: "customer",
  inbox: "SERVICE",
  schema: templateSchema({ domain: z.string(), expiresAt: dateField, expired: z.boolean() }),
  sample: { recipientName: "Ayşe Yılmaz", domain: "ornek.com", expiresAt: "2026-11-01T00:00:00.000Z", expired: false },
  render: (data, { baseUrl }) => ({
    subject: data.expired
      ? `SSL sertifikanızın süresi doldu: ${data.domain}`
      : `SSL sertifikanız yakında sona eriyor: ${data.domain}`,
    heading: data.expired ? "SSL sertifikanızın süresi doldu" : "SSL sertifikanız yakında sona eriyor",
    greetingName: data.recipientName,
    intro: [
      data.expired
        ? `${data.domain} için SSL sertifikanızın süresi ${date(data.expiresAt)} tarihinde doldu. Ziyaretçileriniz güvenlik uyarısı görebilir.`
        : `${data.domain} için SSL sertifikanız ${date(data.expiresAt)} tarihinde sona erecek.`,
    ],
    action: { label: "Sertifikalarım", url: `${baseUrl}/musteri/panel/ssl` },
  }),
  sms: (data, { brand }) =>
    data.expired
      ? `${brand.siteName}: ${data.domain} SSL sertifikanızın süresi doldu.`
      : `${brand.siteName}: ${data.domain} SSL sertifikanız ${date(data.expiresAt)} tarihinde sona eriyor.`,
});
