import { z } from "zod";
import { panelPaths, templateSchema } from "./helpers";
import { defineTemplate } from "./types";

/** Order risk review + identity verification notices (Faz 4, docs/fraud-kyc.md). */

export const KYC_PANEL_PATH = "/musteri/panel/kimlik-dogrulama";

export const orderReviewPending = defineTemplate({
  key: "order.review-pending",
  label: "Siparişiniz inceleniyor",
  group: "Sipariş ve fatura",
  audience: "customer",
  inbox: "BILLING",
  schema: templateSchema({
    orderNumber: z.string(),
    paymentBlocked: z.boolean(),
  }),
  sample: { recipientName: "Ayşe Yılmaz", orderNumber: "S-2026-000123", paymentBlocked: false },
  render: (data, { baseUrl }) => ({
    subject: `Siparişiniz inceleniyor: ${data.orderNumber}`,
    heading: "Siparişiniz inceleniyor",
    greetingName: data.recipientName,
    intro: [
      `${data.orderNumber} numaralı siparişiniz, güvenlik kontrollerimiz kapsamında ekibimiz tarafından kısa bir incelemeye alındı.`,
      data.paymentBlocked
        ? "İnceleme tamamlanana kadar ödeme alınmayacak. Siparişiniz onaylandığında ödemeyi panelden tamamlayabilirsiniz."
        : "Ödemenizi yaptıysanız merak etmeyin: inceleme tamamlanınca kurulum kendiliğinden başlar.",
      "İnceleme genellikle mesai saatleri içinde birkaç saat sürer. Gerekirse sizinle iletişime geçeceğiz.",
    ],
    details: [{ label: "Sipariş", value: data.orderNumber, mono: true }],
    action: { label: "Panele git", url: `${baseUrl}${panelPaths.services}` },
  }),
});

export const orderReviewApproved = defineTemplate({
  key: "order.review-approved",
  label: "Sipariş incelemesi onaylandı",
  group: "Sipariş ve fatura",
  audience: "customer",
  inbox: "BILLING",
  schema: templateSchema({
    orderNumber: z.string(),
    paid: z.boolean(),
  }),
  sample: { recipientName: "Ayşe Yılmaz", orderNumber: "S-2026-000123", paid: true },
  render: (data, { baseUrl }) => ({
    subject: `Siparişiniz onaylandı: ${data.orderNumber}`,
    heading: "Siparişiniz onaylandı",
    greetingName: data.recipientName,
    intro: [
      `${data.orderNumber} numaralı siparişinizin incelemesi tamamlandı ve onaylandı.`,
      data.paid
        ? "Kurulum başlatıldı; hizmetiniz hazır olduğunda ayrıca bilgilendireceğiz."
        : "Ödemenizi panelden tamamladığınızda siparişiniz işleme alınacak.",
    ],
    details: [{ label: "Sipariş", value: data.orderNumber, mono: true }],
    action: data.paid
      ? { label: "Hizmetlerim", url: `${baseUrl}${panelPaths.services}` }
      : { label: "Faturalarım", url: `${baseUrl}${panelPaths.invoices}` },
  }),
});

export const orderReviewRejected = defineTemplate({
  key: "order.review-rejected",
  label: "Sipariş incelemesi reddedildi",
  group: "Sipariş ve fatura",
  audience: "customer",
  inbox: "BILLING",
  schema: templateSchema({
    orderNumber: z.string(),
    reason: z.string().max(500).optional(),
    paid: z.boolean(),
  }),
  sample: { recipientName: "Ayşe Yılmaz", orderNumber: "S-2026-000123", reason: "Kimlik bilgileri doğrulanamadı", paid: true },
  render: (data, { baseUrl }) => ({
    subject: `Siparişiniz onaylanmadı: ${data.orderNumber}`,
    heading: "Siparişiniz onaylanmadı",
    greetingName: data.recipientName,
    intro: [
      `${data.orderNumber} numaralı siparişiniz inceleme sonucunda onaylanmadı ve iptal edildi.`,
      data.paid
        ? "Ödediğiniz tutar iade edilecektir; iade tamamlandığında ayrıca bilgilendirileceksiniz. Kart iadelerinin hesabınıza yansıması bankanıza göre birkaç iş günü sürebilir."
        : "Sipariş için herhangi bir ödeme alınmadı.",
    ],
    details: [
      { label: "Sipariş", value: data.orderNumber, mono: true },
      ...(data.reason ? [{ label: "Açıklama", value: data.reason }] : []),
    ],
    action: { label: "Destek talebi aç", url: `${baseUrl}/musteri/panel/destek/yeni` },
    note: "Bir hata olduğunu düşünüyorsanız destek talebi açarak bize ulaşabilirsiniz.",
  }),
});

export const kycVerificationRequired = defineTemplate({
  key: "kyc.verification-required",
  label: "Kimlik doğrulaması gerekli",
  group: "Hesap",
  audience: "customer",
  inbox: "SERVICE",
  schema: templateSchema({
    orderNumber: z.string(),
    productName: z.string().optional(),
  }),
  sample: { recipientName: "Ayşe Yılmaz", orderNumber: "S-2026-000123", productName: "VDS Pro 4" },
  render: (data, { baseUrl }) => ({
    subject: "Sunucunuzun kurulumu için kimlik doğrulaması gerekiyor",
    heading: "Kimlik doğrulaması gerekiyor",
    greetingName: data.recipientName,
    intro: [
      `${data.orderNumber} numaralı siparişinizin${data.productName ? ` (${data.productName})` : ""} ödemesi alındı. Sunucu hizmetlerinde kurulum, kimlik doğrulamanız onaylandıktan sonra başlar.`,
      "5651 sayılı Kanun gereği, sunucu hizmeti verdiğimiz kişileri tespit edebilmemiz gerekiyor. Kimlik kartınızın (kurumsal müşterilerde vergi levhasının) görüntüsünü panelden yüklemeniz yeterli.",
    ],
    details: [{ label: "Sipariş", value: data.orderNumber, mono: true }],
    action: { label: "Kimlik doğrulamasını başlat", url: `${baseUrl}${KYC_PANEL_PATH}` },
    note: "Belgeleriniz yalnızca yetkili personelimiz tarafından görüntülenir ve KVKK kapsamında korunur.",
  }),
});

export const kycApproved = defineTemplate({
  key: "kyc.approved",
  label: "Kimlik doğrulaması onaylandı",
  group: "Hesap",
  audience: "customer",
  inbox: "SERVICE",
  schema: templateSchema({ releasedOrders: z.number().int().min(0) }),
  sample: { recipientName: "Ayşe Yılmaz", releasedOrders: 1 },
  render: (data, { baseUrl }) => ({
    subject: "Kimlik doğrulamanız onaylandı",
    heading: "Kimlik doğrulamanız onaylandı",
    greetingName: data.recipientName,
    intro: [
      "Gönderdiğiniz belgeler incelendi ve kimlik doğrulamanız onaylandı.",
      data.releasedOrders > 0
        ? "Bekleyen sunucu siparişlerinizin kurulumu başlatıldı; hizmetiniz hazır olduğunda ayrıca bilgilendireceğiz."
        : "Bundan sonraki sunucu siparişleriniz ek bir doğrulama beklemeden işleme alınacak.",
    ],
    action: { label: "Hizmetlerim", url: `${baseUrl}${panelPaths.services}` },
  }),
});

export const kycRejected = defineTemplate({
  key: "kyc.rejected",
  label: "Kimlik doğrulaması reddedildi",
  group: "Hesap",
  audience: "customer",
  inbox: "SERVICE",
  schema: templateSchema({ reason: z.string().max(500) }),
  sample: { recipientName: "Ayşe Yılmaz", reason: "Kimlik kartının arka yüzü okunamıyor" },
  render: (data, { baseUrl }) => ({
    subject: "Kimlik doğrulamanız onaylanmadı",
    heading: "Kimlik doğrulamanız onaylanmadı",
    greetingName: data.recipientName,
    intro: [
      "Gönderdiğiniz belgeleri inceledik ancak kimlik doğrulamanızı onaylayamadık.",
      "Lütfen açıklamayı dikkate alarak belgelerinizi panelden yeniden yükleyin. Reddedilen belgeler bir süre sonra sistemden kalıcı olarak silinir.",
    ],
    details: [{ label: "Açıklama", value: data.reason }],
    action: { label: "Belgeleri yeniden yükle", url: `${baseUrl}${KYC_PANEL_PATH}` },
  }),
});
