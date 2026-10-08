import { z } from "zod";
import { date, dateField, panelPaths, templateSchema } from "./helpers";
import { defineTemplate } from "./types";

export const domainRegistered = defineTemplate({
  key: "domain.registered",
  label: "Alan adı kaydedildi",
  group: "Alan adı",
  audience: "customer",
  inbox: "SERVICE",
  schema: templateSchema({
    domain: z.string(),
    expiresAt: dateField.optional(),
    nameservers: z.array(z.string()).optional(),
    transfer: z.boolean().optional(),
  }),
  sample: {
    recipientName: "Ayşe Yılmaz",
    domain: "ornek.com",
    expiresAt: "2027-10-08T00:00:00.000Z",
    nameservers: ["ns1.kleacore.com", "ns2.kleacore.com"],
  },
  render: (data, { baseUrl }) => ({
    subject: data.transfer ? `Alan adı transferiniz başladı: ${data.domain}` : `Alan adınız kaydedildi: ${data.domain}`,
    heading: data.transfer ? "Alan adı transferiniz başladı" : "Alan adınız kaydedildi",
    greetingName: data.recipientName,
    intro: [
      data.transfer
        ? `${data.domain} alan adınızın transfer işlemi başlatıldı. Transfer, mevcut firmanın onayına bağlı olarak 5–7 gün sürebilir.`
        : `${data.domain} alan adınız adınıza kaydedildi.`,
    ],
    details: [
      { label: "Alan adı", value: data.domain, mono: true },
      ...(data.expiresAt ? [{ label: "Bitiş tarihi", value: date(data.expiresAt) }] : []),
      ...(data.nameservers ?? []).map((ns, index) => ({ label: `Ad sunucusu ${index + 1}`, value: ns, mono: true })),
    ],
    action: { label: "Alan adlarım", url: `${baseUrl}${panelPaths.domains}` },
  }),
});

export const domainRenewed = defineTemplate({
  key: "domain.renewed",
  label: "Alan adı yenilendi",
  group: "Alan adı",
  audience: "customer",
  inbox: "SERVICE",
  schema: templateSchema({
    domain: z.string(),
    expiresAt: dateField.optional(),
    years: z.number().int().positive().optional(),
  }),
  sample: { recipientName: "Ayşe Yılmaz", domain: "ornek.com", expiresAt: "2027-10-08T00:00:00.000Z", years: 1 },
  render: (data, { baseUrl }) => ({
    subject: `Alan adınız yenilendi: ${data.domain}`,
    heading: "Alan adınız yenilendi",
    greetingName: data.recipientName,
    intro: [
      data.years
        ? `${data.domain} alan adınız ${data.years} yıl süreyle yenilendi.`
        : `${data.domain} alan adınız yenilendi.`,
    ],
    details: [
      { label: "Alan adı", value: data.domain, mono: true },
      ...(data.expiresAt ? [{ label: "Yeni bitiş tarihi", value: date(data.expiresAt) }] : []),
    ],
    action: { label: "Alan adlarım", url: `${baseUrl}${panelPaths.domains}` },
  }),
});

/**
 * 30 / 7 / 1 days before expiry and after expiry (daysLeft <= 0). Sent by the
 * domains lifecycle (src/lib/domains/notices.ts), once per domain, period and
 * stage. `stage` distinguishes the post-expiry steps (grace ending, redemption).
 */
export const domainExpiryNotice = defineTemplate({
  key: "domain.expiry-notice",
  label: "Alan adı süre uyarısı (30/7/1/doldu/ek süre/geri alma)",
  group: "Alan adı",
  audience: "customer",
  inbox: "SERVICE",
  schema: templateSchema({
    domain: z.string(),
    daysLeft: z.number().int(),
    renewUrl: z.string().url(),
    expiresAt: dateField.optional(),
    stage: z.enum(["expiring", "expired", "grace_ending", "redemption"]).optional(),
    graceEndsAt: dateField.optional(),
    autoRenew: z.boolean().optional(),
  }),
  sample: {
    recipientName: "Ayşe Yılmaz",
    domain: "ornek.com",
    daysLeft: 7,
    renewUrl: "https://kleacore.com/musteri/panel/domainler",
    expiresAt: "2026-10-15T00:00:00.000Z",
    autoRenew: true,
  },
  render: (data) => {
    const stage = data.stage ?? (data.daysLeft <= 0 ? "expired" : "expiring");
    const when = data.expiresAt ? ` (${date(data.expiresAt)})` : "";
    const graceEnd = data.graceEndsAt ? date(data.graceEndsAt) : null;
    const renewHint =
      data.autoRenew === undefined
        ? null
        : data.autoRenew
          ? "Yenileme faturanızı ödediğinizde alan adınız otomatik olarak yenilenir."
          : "Otomatik yenileme kapalı; alan adınızı korumak için panelden “Şimdi yenile” ile yenileyin.";

    const content = {
      expiring: {
        subject: `${data.domain} alan adınızın süresinin dolmasına ${data.daysLeft} gün kaldı`,
        heading: "Alan adınızın süresi doluyor",
        intro: `${data.domain} alan adınızın süresi ${data.daysLeft} gün sonra doluyor${when}. Kesinti yaşamamak için yenilemeyi unutmayın.`,
        note: "Alan adınızı yenilediyseniz bu e-postayı dikkate almayın.",
      },
      expired: {
        subject: `Alan adınızın süresi doldu: ${data.domain}`,
        heading: "Alan adınızın süresi doldu",
        intro: `${data.domain} alan adınızın süresi doldu${when}. Siteniz ve e-postalarınız çalışmayabilir; alan adınızı kaybetmemek için hemen yenileyin.${graceEnd ? ` ${graceEnd} tarihine kadar normal ücretle yenileyebilirsiniz.` : ""}`,
        note: "Süresi dolan alan adları belirli bir süre sonra herkesin kaydına açılabilir.",
      },
      grace_ending: {
        subject: `${data.domain} için yenileme ek süresi bitiyor`,
        heading: "Yenileme ek süresi bitiyor",
        intro: `${data.domain} için yenileme ek süresi${graceEnd ? ` ${graceEnd} tarihinde` : ""} bitiyor. Sonrasında alan adı geri alma (redemption) sürecine girer ve ek ücret gerekir.`,
        note: "Alan adınızı yenilediyseniz bu e-postayı dikkate almayın.",
      },
      redemption: {
        subject: `${data.domain} geri alma sürecinde`,
        heading: "Alan adınız geri alma sürecinde",
        intro: `${data.domain} yenileme ek süresini aştı ve geri alma (redemption) sürecinde. Alan adını kaybetmemek için destek ekibimizle iletişime geçin.`,
        note: "Geri alma süresi sonunda alan adı herkesin kaydına açılabilir.",
      },
    }[stage];

    return {
      subject: content.subject,
      heading: content.heading,
      greetingName: data.recipientName,
      intro: [content.intro, ...(renewHint && stage !== "redemption" ? [renewHint] : [])],
      details: [{ label: "Alan adı", value: data.domain, mono: true }],
      action: { label: stage === "redemption" ? "Alan adı detayları" : "Alan adını yenile", url: data.renewUrl },
      note: content.note,
    };
  },
  sms: (data, { brand }) =>
    data.daysLeft <= 0
      ? `${brand.siteName}: ${data.domain} alan adınızın süresi doldu. Hemen yenileyin.`
      : `${brand.siteName}: ${data.domain} alan adınızın süresi ${data.daysLeft} gün sonra doluyor.`,
});
