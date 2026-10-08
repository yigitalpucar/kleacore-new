import { z } from "zod";
import { date, dateField, money, moneyField, panelPaths, templateSchema } from "./helpers";
import { defineTemplate } from "./types";

const SAVED_CARDS_PATH = "/musteri/panel/kayitli-kartlar";

/** Masked card label only ("Mastercard •••• 2544") — never a token or full number. */
const cardLabel = z.string().max(64);

export const billingAutoChargeFailed = defineTemplate({
  key: "billing.auto-charge-failed",
  label: "Kartınızdan tahsilat yapılamadı",
  group: "Sipariş ve fatura",
  audience: "customer",
  inbox: "BILLING",
  schema: templateSchema({
    invoiceId: z.string(),
    invoiceNumber: z.string(),
    amount: moneyField,
    dueDate: dateField,
    card: cardLabel,
    reason: z.string().max(200).optional(),
    attempt: z.number().int().min(1),
    maxAttempts: z.number().int().min(1),
  }),
  sample: {
    recipientName: "Ayşe Yılmaz",
    invoiceId: "ornek",
    invoiceNumber: "F-2026-000456",
    amount: "1199.88",
    dueDate: "2026-10-08T00:00:00.000Z",
    card: "Mastercard •••• 2544",
    reason: "Yetersiz bakiye",
    attempt: 1,
    maxAttempts: 3,
  },
  render: (data, { baseUrl }) => {
    const remaining = data.maxAttempts - data.attempt;
    return {
      subject: `Kartınızdan tahsilat yapılamadı: ${data.invoiceNumber}`,
      heading: "Kartınızdan tahsilat yapılamadı",
      greetingName: data.recipientName,
      intro: [
        `${data.invoiceNumber} numaralı faturanız için kayıtlı kartınızdan (${data.card}) otomatik tahsilat denedik, ancak ödeme alınamadı.`,
        remaining > 0
          ? `Ertesi gün yeniden deneyeceğiz (kalan deneme: ${remaining}). Dilerseniz faturayı hemen başka bir kartla veya havale ile ödeyebilirsiniz.`
          : "Otomatik tahsilat için deneme hakkı doldu. Hizmetinizin kesintiye uğramaması için lütfen faturayı panelden ödeyin.",
      ],
      details: [
        { label: "Fatura", value: data.invoiceNumber, mono: true },
        { label: "Tutar", value: money(data.amount) },
        { label: "Son ödeme tarihi", value: date(data.dueDate) },
        { label: "Kart", value: data.card },
        ...(data.reason ? [{ label: "Banka yanıtı", value: data.reason }] : []),
      ],
      action: { label: "Faturayı öde", url: `${baseUrl}${panelPaths.invoice(data.invoiceId)}` },
      note: "Kart bilgilerinizi güncellemek için Panel → Kayıtlı kartlarım sayfasını kullanabilirsiniz.",
    };
  },
  sms: (data, { brand }) =>
    `${brand.siteName}: ${data.invoiceNumber} numaralı ${money(data.amount)} faturanız kayıtlı kartınızdan tahsil edilemedi. Lütfen panelden ödeme yapın.`,
});

export const billingCardExpiring = defineTemplate({
  key: "billing.card-expiring",
  label: "Kayıtlı kartın süresi doluyor",
  group: "Sipariş ve fatura",
  audience: "customer",
  inbox: "BILLING",
  schema: templateSchema({
    card: cardLabel,
    expiresAt: dateField,
    autoPay: z.boolean(),
  }),
  sample: {
    recipientName: "Ayşe Yılmaz",
    card: "Visa •••• 4242",
    expiresAt: "2026-11-30T00:00:00.000Z",
    autoPay: true,
  },
  render: (data, { baseUrl }) => ({
    subject: "Kayıtlı kartınızın süresi doluyor",
    heading: "Kayıtlı kartınızın süresi doluyor",
    greetingName: data.recipientName,
    intro: [
      `Hesabınızda kayıtlı ${data.card} kartınızın son kullanma tarihi ${date(data.expiresAt)}.`,
      data.autoPay
        ? "Otomatik ödemelerinizin aksamaması için yeni kartınızı ekleyip varsayılan yapmanızı öneririz."
        : "Kartla hızlı ödemeye devam etmek için yeni kartınızı ekleyebilirsiniz.",
    ],
    action: { label: "Kayıtlı kartlarım", url: `${baseUrl}${SAVED_CARDS_PATH}` },
  }),
});
