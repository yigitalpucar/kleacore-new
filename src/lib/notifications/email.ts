import { db } from "@/lib/db";
import { plainTextToHtml, sendTransactionalEmail } from "@/lib/mail";
import { getAppBaseUrl } from "@/lib/stripe";
import type { EmailMessageCategory, PaymentMethod } from "@prisma/client";

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("tr-TR");

type NotificationCategory = EmailMessageCategory;

interface CustomerRecipient {
  customerId: string;
  email: string;
  fullName?: string;
}

export interface OrderConfirmationEmailInput {
  customer: CustomerRecipient;
  orderNumbers: string[];
  totalAmount: number;
  paymentMethod: PaymentMethod;
  isPaid: boolean;
  promoCode?: string;
}

export interface PaymentReceivedEmailInput {
  customer: CustomerRecipient;
  invoiceId: string;
  invoiceNumber: string;
  paidAmount: number;
  paidAt: Date;
}

export interface InvoiceCreatedEmailInput {
  customer: CustomerRecipient;
  invoiceId: string;
  invoiceNumber: string;
  totalAmount: number;
  dueDate: Date;
}

export interface InvoiceOverdueEmailInput {
  customer: CustomerRecipient;
  invoiceId: string;
  invoiceNumber: string;
  totalAmount: number;
  dueDate: Date;
}

export interface InvoicePaymentReminderEmailInput {
  customer: CustomerRecipient;
  invoiceId: string;
  invoiceNumber: string;
  totalAmount: number;
  dueDate: Date;
}

export interface TicketReplyEmailInput {
  recipientEmail: string;
  recipientName?: string;
  ticketId: string;
  ticketNumber: string;
  ticketSubject: string;
  senderName: string;
  messagePreview: string;
  recipientRole: "CUSTOMER" | "ADMIN";
  customerId?: string;
}

export interface ServiceSuspendedEmailInput {
  customer: CustomerRecipient;
  serviceId: string;
  serviceLabel: string;
  reason: string;
  suspendedAt: Date;
}

export interface AffiliatePayoutCompletedEmailInput {
  customer: CustomerRecipient;
  paymentId: string;
  amount: number;
  paidAt: Date;
}

function formatFullName(name?: string, surname?: string) {
  return `${name ?? ""} ${surname ?? ""}`.trim();
}

function greeting(name?: string) {
  return name ? `Merhaba ${name},` : "Merhaba,";
}

function formatCurrency(amount: number) {
  return currencyFormatter.format(amount);
}

function formatDate(date: Date) {
  return dateFormatter.format(date);
}

function paymentMethodLabel(method: PaymentMethod) {
  switch (method) {
    case "BALANCE":
      return "Bakiye";
    case "BANK_TRANSFER":
      return "Banka Havalesi";
    case "CREDIT_CARD":
      return "Kredi Kartı";
    default:
      return method;
  }
}

function buildHtmlEmail(title: string, lines: string[], action?: { label: string; href: string }) {
  const body = lines
    .map((line) => (line.trim() ? `<p>${line}</p>` : "<br />"))
    .join("");

  const actionHtml = action
    ? `<p><a href="${action.href}" style="display:inline-block;padding:10px 14px;background:#111827;color:#fff;text-decoration:none;border-radius:8px">${action.label}</a></p>`
    : "";

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
      <h2>${title}</h2>
      ${body}
      ${actionHtml}
      <p>KLEACORE</p>
    </div>
  `;
}

async function recordInboxMessage(input: {
  customerId: string;
  subject: string;
  preview: string;
  content: string;
  category: NotificationCategory;
}) {
  await db.emailMessage.create({
    data: {
      customerId: input.customerId,
      subject: input.subject,
      preview: input.preview,
      content: input.content,
      category: input.category,
    },
  });
}

async function deliverNotification(input: {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
  inbox?: {
    customerId: string;
    preview: string;
    category: NotificationCategory;
  };
}) {
  if (input.inbox) {
    await recordInboxMessage({
      customerId: input.inbox.customerId,
      subject: input.subject,
      preview: input.inbox.preview,
      content: input.text,
      category: input.inbox.category,
    });
  }

  const result = await sendTransactionalEmail({
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });

  if (!result.sent && result.skipped) {
    console.info(
      `[Notifications] E-posta atlandı (${result.reason ?? "UNKNOWN"}): ${input.subject}`
    );
  }

  return result;
}

export function dispatchNotification(task: () => Promise<void>) {
  void task().catch((error) => {
    console.error("[Notifications] E-posta gönderimi başarısız:", error);
  });
}

export async function sendOrderConfirmationEmail(input: OrderConfirmationEmailInput) {
  const baseUrl = getAppBaseUrl();
  const orderLabel =
    input.orderNumbers.length === 1
      ? input.orderNumbers[0]
      : `${input.orderNumbers.length} sipariş (${input.orderNumbers.join(", ")})`;

  const subject = input.isPaid
    ? `Siparişiniz Alındı ve Ödendi: ${orderLabel}`
    : `Siparişiniz Alındı - Ödeme Bekleniyor: ${orderLabel}`;

  const preview = input.isPaid
    ? "Sepet ödemeniz başarıyla tamamlandı."
    : input.paymentMethod === "CREDIT_CARD"
      ? "Kredi kartı ödemeniz tamamlandığında siparişiniz işleme alınacaktır."
      : "Banka transferi sonrası siparişiniz işleme alınacaktır.";

  const lines = [
    greeting(input.customer.fullName),
    "",
    input.isPaid
      ? "Sepet ödemeniz başarıyla tamamlandı ve siparişiniz işleme alındı."
      : input.paymentMethod === "CREDIT_CARD"
        ? "Siparişiniz oluşturuldu. Kredi kartı ödemeniz tamamlandığında otomatik onaylanacaktır."
        : "Siparişiniz oluşturuldu. Banka transferi tamamlandığında ödeme onayı verilecektir.",
    `Sipariş numarası: ${orderLabel}`,
    `Ödeme yöntemi: ${paymentMethodLabel(input.paymentMethod)}`,
    `Toplam tutar: ${formatCurrency(input.totalAmount)}`,
    ...(input.promoCode ? [`Uygulanan kupon: ${input.promoCode}`] : []),
    "",
    "Siparişlerinizi müşteri panelinizden takip edebilirsiniz.",
  ];

  const text = lines.join("\n");

  return deliverNotification({
    to: input.customer.email,
    subject,
    text,
    html: buildHtmlEmail(
      input.isPaid ? "Siparişiniz Alındı ve Ödendi" : "Siparişiniz Alındı",
      lines,
      { label: "Müşteri Paneli", href: `${baseUrl}/musteri/panel` }
    ),
    inbox: {
      customerId: input.customer.customerId,
      preview,
      category: "BILLING",
    },
  });
}

export async function sendPaymentReceivedEmail(input: PaymentReceivedEmailInput) {
  const baseUrl = getAppBaseUrl();
  const subject = `Ödeme Alındı: ${input.invoiceNumber}`;
  const preview = `${input.invoiceNumber} numaralı faturanızın ödemesi alındı.`;

  const lines = [
    greeting(input.customer.fullName),
    "",
    `${input.invoiceNumber} numaralı faturanızın ödemesi başarıyla alınmıştır.`,
    `Ödenen tutar: ${formatCurrency(input.paidAmount)}`,
    `Ödeme tarihi: ${formatDate(input.paidAt)}`,
    "",
    "Hizmetleriniz müşteri panelinizden görüntülenebilir.",
  ];

  const text = lines.join("\n");

  return deliverNotification({
    to: input.customer.email,
    subject,
    text,
    html: buildHtmlEmail("Ödeme Alındı", lines, {
      label: "Fatura Detayı",
      href: `${baseUrl}/musteri/panel/faturalar/${input.invoiceId}`,
    }),
    inbox: {
      customerId: input.customer.customerId,
      preview,
      category: "BILLING",
    },
  });
}

export async function sendInvoiceCreatedEmail(input: InvoiceCreatedEmailInput) {
  const baseUrl = getAppBaseUrl();
  const subject = `Yeni Fatura: ${input.invoiceNumber}`;
  const preview = `${input.invoiceNumber} numaralı yeni faturanız oluşturuldu.`;

  const lines = [
    greeting(input.customer.fullName),
    "",
    `${input.invoiceNumber} numaralı yeni faturanız oluşturulmuştur.`,
    `Toplam tutar: ${formatCurrency(input.totalAmount)}`,
    `Son ödeme tarihi: ${formatDate(input.dueDate)}`,
    "",
    "Ödemenizi müşteri panelinizdeki fatura detayından tamamlayabilirsiniz.",
  ];

  const text = lines.join("\n");

  return deliverNotification({
    to: input.customer.email,
    subject,
    text,
    html: buildHtmlEmail("Yeni Fatura", lines, {
      label: "Faturayı Görüntüle",
      href: `${baseUrl}/musteri/panel/faturalar/${input.invoiceId}`,
    }),
    inbox: {
      customerId: input.customer.customerId,
      preview,
      category: "BILLING",
    },
  });
}

export async function sendInvoicePaymentReminderEmail(input: InvoicePaymentReminderEmailInput) {
  const baseUrl = getAppBaseUrl();
  const subject = `Fatura Hatırlatması: ${input.invoiceNumber}`;
  const preview = `${input.invoiceNumber} numaralı faturanız için ödeme hatırlatması.`;

  const lines = [
    greeting(input.customer.fullName),
    "",
    `${input.invoiceNumber} numaralı faturanız için ödeme hatırlatmasıdır.`,
    `Son ödeme tarihi: ${formatDate(input.dueDate)}`,
    `Toplam tutar: ${formatCurrency(input.totalAmount)}`,
    "",
    "Ödemenizi müşteri panelinizdeki fatura detayından tamamlayabilirsiniz.",
  ];

  const text = lines.join("\n");

  return deliverNotification({
    to: input.customer.email,
    subject,
    text,
    html: buildHtmlEmail("Fatura Hatırlatması", lines, {
      label: "Faturayı Görüntüle",
      href: `${baseUrl}/musteri/panel/faturalar/${input.invoiceId}`,
    }),
    inbox: {
      customerId: input.customer.customerId,
      preview,
      category: "BILLING",
    },
  });
}

export async function sendInvoiceOverdueEmail(input: InvoiceOverdueEmailInput) {
  const baseUrl = getAppBaseUrl();
  const subject = `Gecikmiş Fatura: ${input.invoiceNumber}`;
  const preview = `${input.invoiceNumber} numaralı faturanızın ödeme tarihi geçmiştir.`;

  const lines = [
    greeting(input.customer.fullName),
    "",
    `${input.invoiceNumber} numaralı faturanızın son ödeme tarihi geçmiştir.`,
    `Son ödeme tarihi: ${formatDate(input.dueDate)}`,
    `Toplam tutar: ${formatCurrency(input.totalAmount)}`,
    "",
    "Hizmet kesintisi yaşamamak için lütfen en kısa sürede ödemenizi tamamlayın.",
  ];

  const text = lines.join("\n");

  return deliverNotification({
    to: input.customer.email,
    subject,
    text,
    html: buildHtmlEmail("Gecikmiş Fatura", lines, {
      label: "Faturayı Öde",
      href: `${baseUrl}/musteri/panel/faturalar/${input.invoiceId}`,
    }),
    inbox: {
      customerId: input.customer.customerId,
      preview,
      category: "BILLING",
    },
  });
}

export async function sendTicketReplyEmail(input: TicketReplyEmailInput) {
  const baseUrl = getAppBaseUrl();
  const panelPath =
    input.recipientRole === "CUSTOMER"
      ? `/musteri/panel/destek/${input.ticketId}`
      : `/yonetim/destek/${input.ticketId}`;

  const subject = `Destek Yanıtı: ${input.ticketNumber}`;
  const preview = `${input.senderName} destek talebinize yanıt verdi.`;
  const messagePreview =
    input.messagePreview.length > 240
      ? `${input.messagePreview.slice(0, 240)}...`
      : input.messagePreview;

  const lines = [
    greeting(input.recipientName),
    "",
    `${input.senderName}, "${input.ticketSubject}" konulu ${input.ticketNumber} numaralı destek talebinize yanıt verdi.`,
    "",
    messagePreview,
    "",
    "Tüm mesajı görüntülemek için destek panelinizi ziyaret edin.",
  ];

  const text = lines.join("\n");

  return deliverNotification({
    to: input.recipientEmail,
    subject,
    text,
    html: buildHtmlEmail("Destek Yanıtı", lines, {
      label: "Talebi Görüntüle",
      href: `${baseUrl}${panelPath}`,
    }),
    inbox: input.customerId
      ? {
          customerId: input.customerId,
          preview,
          category: "SUPPORT",
        }
      : undefined,
  });
}

export async function sendServiceSuspendedEmail(input: ServiceSuspendedEmailInput) {
  const baseUrl = getAppBaseUrl();
  const serviceName = input.serviceLabel.trim() || "Hizmetiniz";
  const subject = `Hizmet Askıya Alındı: ${serviceName}`;
  const preview = `${serviceName} askıya alınmıştır.`;

  const lines = [
    greeting(input.customer.fullName),
    "",
    `${serviceName} adlı hizmetiniz askıya alınmıştır.`,
    `Askıya alma tarihi: ${formatDate(input.suspendedAt)}`,
    `Sebep: ${input.reason}`,
    "",
    "Ödeme veya destek işlemleri için müşteri panelinizi kullanabilirsiniz.",
  ];

  const text = lines.join("\n");

  return deliverNotification({
    to: input.customer.email,
    subject,
    text,
    html: buildHtmlEmail("Hizmet Askıya Alındı", lines, {
      label: "Hizmetlerim",
      href: `${baseUrl}/musteri/panel/hizmetlerim/${input.serviceId}`,
    }),
    inbox: {
      customerId: input.customer.customerId,
      preview,
      category: "SERVICE",
    },
  });
}

export async function sendAffiliatePayoutCompletedEmail(
  input: AffiliatePayoutCompletedEmailInput
) {
  const baseUrl = getAppBaseUrl();
  const subject = `Satış Ortaklığı Ödemeniz Tamamlandı`;
  const preview = `${formatCurrency(input.amount)} tutarındaki ödeme talebiniz tamamlandı.`;

  const lines = [
    greeting(input.customer.fullName),
    "",
    "Satış ortaklığı ödeme talebiniz başarıyla tamamlandı.",
    `Talep numarası: ${input.paymentId}`,
    `Ödeme tutarı: ${formatCurrency(input.amount)}`,
    `Ödeme tarihi: ${formatDate(input.paidAt)}`,
    "",
    "Detayları satış ortaklığı panelinizden görüntüleyebilirsiniz.",
  ];

  const text = lines.join("\n");

  return deliverNotification({
    to: input.customer.email,
    subject,
    text,
    html: buildHtmlEmail("Satış Ortaklığı Ödemesi Tamamlandı", lines, {
      label: "Satış Ortaklığı Paneli",
      href: `${baseUrl}/musteri/panel/satis-ortakligi`,
    }),
    inbox: {
      customerId: input.customer.customerId,
      preview,
      category: "BILLING",
    },
  });
}

export async function loadSupportNotificationEmail() {
  const settings = await db.setting.findMany({
    where: {
      key: {
        in: ["company_email"],
      },
    },
    select: { key: true, value: true },
  });

  const companyEmail = settings.find((setting) => setting.key === "company_email")?.value?.trim();
  return companyEmail || process.env.SMTP_FROM || process.env.EMAIL_FROM || null;
}

export async function loadCustomerRecipient(customerId: string) {
  const customer = await db.user.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      email: true,
      name: true,
      surname: true,
    },
  });

  if (!customer) {
    return null;
  }

  return {
    customerId: customer.id,
    email: customer.email,
    fullName: formatFullName(customer.name, customer.surname),
  };
}