import { z } from "zod";
import { date, dateField, money, moneyField, panelPaths, templateSchema } from "./helpers";
import { defineTemplate } from "./types";

const paymentMethodLabels: Record<string, string> = {
  BALANCE: "Bakiye",
  BANK_TRANSFER: "Banka havalesi / EFT",
  CREDIT_CARD: "Kredi kartı",
};

export const billingOrderReceived = defineTemplate({
  key: "billing.order-received",
  label: "Sipariş alındı",
  group: "Sipariş ve fatura",
  audience: "customer",
  inbox: "BILLING",
  schema: templateSchema({
    orderNumbers: z.array(z.string()).min(1),
    totalAmount: moneyField,
    paymentMethod: z.string(),
    isPaid: z.boolean(),
    promoCode: z.string().optional(),
  }),
  sample: {
    recipientName: "Ayşe Yılmaz",
    orderNumbers: ["S-2026-000123"],
    totalAmount: "1199.88",
    paymentMethod: "CREDIT_CARD",
    isPaid: false,
  },
  render: (data, { baseUrl }) => {
    const orderLabel = data.orderNumbers.join(", ");
    const pendingText =
      data.paymentMethod === "BANK_TRANSFER"
        ? "Havale/EFT ödemeniz onaylandığında siparişiniz işleme alınacaktır."
        : "Ödemeniz tamamlandığında siparişiniz otomatik olarak işleme alınacaktır.";
    return {
      subject: `Siparişiniz alındı: ${orderLabel}`,
      heading: "Siparişiniz alındı",
      greetingName: data.recipientName,
      intro: [
        data.isPaid
          ? "Siparişiniz ve ödemeniz alındı, siparişiniz işleme alındı."
          : `Siparişiniz oluşturuldu. ${pendingText}`,
      ],
      details: [
        { label: data.orderNumbers.length > 1 ? "Sipariş numaraları" : "Sipariş numarası", value: orderLabel, mono: true },
        { label: "Ödeme yöntemi", value: paymentMethodLabels[data.paymentMethod] ?? data.paymentMethod },
        { label: "Toplam tutar", value: money(data.totalAmount) },
        ...(data.promoCode ? [{ label: "Kupon", value: data.promoCode, mono: true }] : []),
      ],
      action: { label: "Siparişlerimi görüntüle", url: `${baseUrl}${panelPaths.invoices}` },
    };
  },
});

export const billingPaymentReceived = defineTemplate({
  key: "billing.payment-received",
  label: "Ödeme alındı",
  group: "Sipariş ve fatura",
  audience: "customer",
  inbox: "BILLING",
  schema: templateSchema({
    invoiceId: z.string(),
    invoiceNumber: z.string(),
    paidAmount: moneyField,
    paidAt: dateField,
    receipt: z.boolean().optional(),
  }),
  sample: {
    recipientName: "Ayşe Yılmaz",
    invoiceId: "ornek",
    invoiceNumber: "F-2026-000456",
    paidAmount: "1199.88",
    paidAt: "2026-10-08T10:15:00.000Z",
  },
  render: (data, { baseUrl }) => ({
    subject: data.receipt ? `Ödeme makbuzu: ${data.invoiceNumber}` : `Ödemeniz alındı: ${data.invoiceNumber}`,
    heading: data.receipt ? "Ödeme makbuzu" : "Ödemeniz alındı",
    greetingName: data.recipientName,
    intro: [
      `${data.invoiceNumber} numaralı faturanızın ödemesi başarıyla alındı. Teşekkür ederiz.`,
      ...(data.receipt ? ["Bu e-posta ödeme makbuzu niteliğindedir."] : []),
    ],
    details: [
      { label: "Fatura", value: data.invoiceNumber, mono: true },
      { label: "Ödenen tutar", value: money(data.paidAmount) },
      { label: "Ödeme tarihi", value: date(data.paidAt) },
    ],
    action: { label: "Faturayı görüntüle", url: `${baseUrl}${panelPaths.invoice(data.invoiceId)}` },
  }),
  sms: (data, { brand }) => `${brand.siteName}: ${data.invoiceNumber} numaralı faturanızın ${money(data.paidAmount)} ödemesi alındı. Teşekkür ederiz.`,
});

const invoiceShape = {
  invoiceId: z.string(),
  invoiceNumber: z.string(),
  totalAmount: moneyField,
  dueDate: dateField,
};

const invoiceSample = {
  recipientName: "Ayşe Yılmaz",
  invoiceId: "ornek",
  invoiceNumber: "F-2026-000456",
  totalAmount: "599.94",
  dueDate: "2026-10-15T00:00:00.000Z",
};

export const billingInvoiceCreated = defineTemplate({
  key: "billing.invoice-created",
  label: "Fatura oluştu",
  group: "Sipariş ve fatura",
  audience: "customer",
  inbox: "BILLING",
  schema: templateSchema(invoiceShape),
  sample: invoiceSample,
  render: (data, { baseUrl }) => ({
    subject: `Yeni faturanız: ${data.invoiceNumber}`,
    heading: "Yeni faturanız oluşturuldu",
    greetingName: data.recipientName,
    intro: [`${data.invoiceNumber} numaralı faturanız oluşturuldu. Son ödeme tarihine kadar panelinizden ödeyebilirsiniz.`],
    details: [
      { label: "Fatura", value: data.invoiceNumber, mono: true },
      { label: "Tutar", value: money(data.totalAmount) },
      { label: "Son ödeme tarihi", value: date(data.dueDate) },
    ],
    action: { label: "Faturayı öde", url: `${baseUrl}${panelPaths.invoice(data.invoiceId)}` },
  }),
});

export const billingInvoiceReminder = defineTemplate({
  key: "billing.invoice-reminder",
  label: "Fatura hatırlatma (vade yaklaşıyor)",
  group: "Sipariş ve fatura",
  audience: "customer",
  inbox: "BILLING",
  schema: templateSchema({ ...invoiceShape, daysLeft: z.number().int().optional() }),
  sample: { ...invoiceSample, daysLeft: 3 },
  render: (data, { baseUrl }) => ({
    subject: `Hatırlatma: ${data.invoiceNumber} numaralı faturanızın son ödeme tarihi yaklaşıyor`,
    heading: "Ödeme hatırlatması",
    greetingName: data.recipientName,
    intro: [
      data.daysLeft && data.daysLeft > 0
        ? `${data.invoiceNumber} numaralı faturanızın son ödeme tarihine ${data.daysLeft} gün kaldı.`
        : `${data.invoiceNumber} numaralı faturanızın son ödeme tarihi yaklaşıyor.`,
      "Hizmetlerinizin kesintisiz devam etmesi için ödemenizi vadesinde tamamlayın.",
    ],
    details: [
      { label: "Fatura", value: data.invoiceNumber, mono: true },
      { label: "Tutar", value: money(data.totalAmount) },
      { label: "Son ödeme tarihi", value: date(data.dueDate) },
    ],
    action: { label: "Faturayı öde", url: `${baseUrl}${panelPaths.invoice(data.invoiceId)}` },
    note: "Ödemenizi yaptıysanız bu e-postayı dikkate almayın.",
  }),
  sms: (data, { brand }) =>
    `${brand.siteName}: ${data.invoiceNumber} numaralı ${money(data.totalAmount)} faturanızın son ödeme tarihi ${date(data.dueDate)}.`,
});

export const billingInvoiceOverdue = defineTemplate({
  key: "billing.invoice-overdue",
  label: "Fatura gecikti",
  group: "Sipariş ve fatura",
  audience: "customer",
  inbox: "BILLING",
  schema: templateSchema({ ...invoiceShape, suspendAfterDays: z.number().int().optional() }),
  sample: { ...invoiceSample, dueDate: "2026-10-05T00:00:00.000Z", suspendAfterDays: 3 },
  render: (data, { baseUrl }) => ({
    subject: `Gecikmiş fatura: ${data.invoiceNumber}`,
    heading: "Faturanızın ödeme tarihi geçti",
    greetingName: data.recipientName,
    intro: [
      `${data.invoiceNumber} numaralı faturanızın son ödeme tarihi (${date(data.dueDate)}) geçti.`,
      data.suspendAfterDays
        ? `Ödeme yapılmazsa ilgili hizmet son ödeme tarihinden ${data.suspendAfterDays} gün sonra askıya alınır.`
        : "Hizmet kesintisi yaşamamak için lütfen ödemenizi en kısa sürede tamamlayın.",
    ],
    details: [
      { label: "Fatura", value: data.invoiceNumber, mono: true },
      { label: "Tutar", value: money(data.totalAmount) },
      { label: "Son ödeme tarihi", value: date(data.dueDate) },
    ],
    action: { label: "Faturayı öde", url: `${baseUrl}${panelPaths.invoice(data.invoiceId)}` },
    note: "Ödemenizi yaptıysanız bu e-postayı dikkate almayın.",
  }),
  sms: (data, { brand }) =>
    `${brand.siteName}: ${data.invoiceNumber} numaralı faturanızın ödeme tarihi geçti. Hizmet kesintisi yaşamamak için lütfen ödeme yapın.`,
});

export const billingBankTransferApproved = defineTemplate({
  key: "billing.bank-transfer-approved",
  label: "Havale bildirimi onaylandı",
  group: "Sipariş ve fatura",
  audience: "customer",
  inbox: "BILLING",
  schema: templateSchema({
    invoiceId: z.string().optional(),
    invoiceNumber: z.string().optional(),
    amount: moneyField,
  }),
  sample: { recipientName: "Ayşe Yılmaz", invoiceId: "ornek", invoiceNumber: "F-2026-000456", amount: "599.94" },
  render: (data, { baseUrl }) => ({
    subject: data.invoiceNumber ? `Havale bildiriminiz onaylandı: ${data.invoiceNumber}` : "Havale bildiriminiz onaylandı",
    heading: "Havale bildiriminiz onaylandı",
    greetingName: data.recipientName,
    intro: ["Havale/EFT ödemeniz hesabımıza ulaştı ve onaylandı."],
    details: [
      ...(data.invoiceNumber ? [{ label: "Fatura", value: data.invoiceNumber, mono: true }] : []),
      { label: "Tutar", value: money(data.amount) },
    ],
    action: {
      label: "Faturayı görüntüle",
      url: `${baseUrl}${data.invoiceId ? panelPaths.invoice(data.invoiceId) : panelPaths.invoices}`,
    },
  }),
});

export const billingBankTransferRejected = defineTemplate({
  key: "billing.bank-transfer-rejected",
  label: "Havale bildirimi reddedildi",
  group: "Sipariş ve fatura",
  audience: "customer",
  inbox: "BILLING",
  schema: templateSchema({
    invoiceId: z.string().optional(),
    invoiceNumber: z.string().optional(),
    amount: moneyField.optional(),
    reason: z.string().min(1),
  }),
  sample: {
    recipientName: "Ayşe Yılmaz",
    invoiceId: "ornek",
    invoiceNumber: "F-2026-000456",
    amount: "599.94",
    reason: "Belirtilen tutar hesabımıza ulaşmadı.",
  },
  render: (data, { baseUrl }) => ({
    subject: data.invoiceNumber ? `Havale bildiriminiz onaylanmadı: ${data.invoiceNumber}` : "Havale bildiriminiz onaylanmadı",
    heading: "Havale bildiriminiz onaylanmadı",
    greetingName: data.recipientName,
    intro: ["Gönderdiğiniz havale/EFT bildirimi incelendi ancak onaylanamadı."],
    details: [
      ...(data.invoiceNumber ? [{ label: "Fatura", value: data.invoiceNumber, mono: true }] : []),
      ...(data.amount ? [{ label: "Bildirilen tutar", value: money(data.amount) }] : []),
      { label: "Sebep", value: data.reason },
    ],
    action: {
      label: "Faturayı görüntüle",
      url: `${baseUrl}${data.invoiceId ? panelPaths.invoice(data.invoiceId) : panelPaths.invoices}`,
    },
    note: "Ödemenizi yaptığınızı düşünüyorsanız dekontunuzla birlikte destek talebi oluşturun.",
  }),
});

export const billingRefundIssued = defineTemplate({
  key: "billing.refund-issued",
  label: "İade yapıldı",
  group: "Sipariş ve fatura",
  audience: "customer",
  inbox: "BILLING",
  schema: templateSchema({
    invoiceId: z.string().optional(),
    invoiceNumber: z.string().optional(),
    amount: moneyField,
    /** CARD | BANK | BALANCE (other values get a generic sentence). */
    method: z.string().optional(),
    refundedAt: dateField,
    reason: z.string().optional(),
  }),
  sample: {
    recipientName: "Ayşe Yılmaz",
    invoiceId: "ornek",
    invoiceNumber: "F-2026-000456",
    amount: "599.94",
    method: "CARD",
    refundedAt: "2026-10-08T10:15:00.000Z",
  },
  render: (data, { baseUrl }) => {
    const method = data.method?.toUpperCase();
    const methodText =
      method === "CARD" || method === "CREDIT_CARD"
        ? "İade kartınıza yapıldı; bankanıza bağlı olarak hesabınıza yansıması 2–10 iş günü sürebilir."
        : method === "BALANCE"
          ? "İade tutarı hesap bakiyenize eklendi."
          : method === "BANK" || method === "BANK_TRANSFER"
            ? "İade banka hesabınıza gönderildi."
            : "İade işleminiz tamamlandı.";
    return {
      subject: data.invoiceNumber ? `İadeniz yapıldı: ${data.invoiceNumber}` : "İadeniz yapıldı",
      heading: "İadeniz yapıldı",
      greetingName: data.recipientName,
      intro: [methodText],
      details: [
        ...(data.invoiceNumber ? [{ label: "Fatura", value: data.invoiceNumber, mono: true }] : []),
        { label: "İade tutarı", value: money(data.amount) },
        { label: "İade tarihi", value: date(data.refundedAt) },
        ...(data.reason ? [{ label: "Açıklama", value: data.reason }] : []),
      ],
      action: {
        label: "Faturayı görüntüle",
        url: `${baseUrl}${data.invoiceId ? panelPaths.invoice(data.invoiceId) : panelPaths.invoices}`,
      },
    };
  },
});

export const affiliatePayoutCompleted = defineTemplate({
  key: "affiliate.payout-completed",
  label: "Satış ortaklığı ödemesi tamamlandı",
  group: "Sipariş ve fatura",
  audience: "customer",
  inbox: "BILLING",
  schema: templateSchema({ paymentId: z.string(), amount: moneyField, paidAt: dateField }),
  sample: { recipientName: "Ayşe Yılmaz", paymentId: "ornek", amount: "250", paidAt: "2026-10-08T10:15:00.000Z" },
  render: (data, { baseUrl }) => ({
    subject: "Satış ortaklığı ödemeniz tamamlandı",
    heading: "Satış ortaklığı ödemeniz tamamlandı",
    greetingName: data.recipientName,
    intro: ["Satış ortaklığı ödeme talebiniz tamamlandı."],
    details: [
      { label: "Talep", value: data.paymentId, mono: true },
      { label: "Tutar", value: money(data.amount) },
      { label: "Ödeme tarihi", value: date(data.paidAt) },
    ],
    action: { label: "Satış ortaklığı paneli", url: `${baseUrl}${panelPaths.affiliate}` },
  }),
  sms: (data, { brand }) => `${brand.siteName}: ${money(data.amount)} satış ortaklığı ödemeniz tamamlandı.`,
});
