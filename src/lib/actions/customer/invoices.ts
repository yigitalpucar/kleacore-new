"use server";

import { db } from "@/lib/db";
import { requireCustomer } from "@/lib/utils/auth-helpers";
import { revalidatePath } from "next/cache";
import {
  CUSTOMER_PAYMENT_METHODS,
  type CustomerPaymentMethod,
} from "@/lib/payments/methods";
import {
  initiateCreditCardPayment,
  isStripePaymentMethod,
  roundMoney,
} from "@/lib/payments/orchestrator";
import { createLogger } from "@/lib/logger";

const log = createLogger("customer.invoices");

interface PayInvoiceInput {
  invoiceId: string;
  paymentMethod: CustomerPaymentMethod;
}

const allowedPaymentMethods: CustomerPaymentMethod[] = [...CUSTOMER_PAYMENT_METHODS];

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
});

export async function payInvoice(input: PayInvoiceInput) {
  const session = await requireCustomer();

  if (!input?.invoiceId) {
    return { success: false, error: "Fatura seçilmedi" };
  }

  if (!allowedPaymentMethods.includes(input.paymentMethod)) {
    return { success: false, error: "Geçersiz ödeme yöntemi" };
  }

  try {
    const invoice = await db.invoice.findUnique({
      where: { id: input.invoiceId },
      select: {
        id: true,
        invoiceNumber: true,
        customerId: true,
        status: true,
        totalAmount: true,
        paidAmount: true,
        dueDate: true,
      },
    });

    if (!invoice) {
      return { success: false, error: "Fatura bulunamadı" };
    }

    if (invoice.customerId !== session.user.id) {
      return { success: false, error: "Bu faturaya erişim yetkiniz yok" };
    }

    if (invoice.status === "PAID") {
      return { success: false, error: "Bu fatura zaten ödenmiş" };
    }

    if (invoice.status === "CANCELLED") {
      return { success: false, error: "İptal edilmiş fatura ödenemez" };
    }

    const remainingAmount = roundMoney(
      Math.max(0, Number(invoice.totalAmount) - Number(invoice.paidAmount))
    );

    if (remainingAmount <= 0) {
      return { success: false, error: "Ödenecek tutar bulunamadı" };
    }

    const now = new Date();
    const isBankTransfer = input.paymentMethod === "BANK_TRANSFER";

    if (isStripePaymentMethod(input.paymentMethod)) {
      const existingPendingPayment = await db.payment.findFirst({
        where: {
          invoiceId: invoice.id,
          customerId: session.user.id,
          method: "CREDIT_CARD",
          status: "PENDING",
          // Only reuse a row no gateway session has claimed yet; rows bound
          // to earlier sessions must keep their amount for callback matching.
          transactionId: null,
        },
        orderBy: { createdAt: "desc" },
      });

      if (!existingPendingPayment) {
        await db.payment.create({
          data: {
            invoiceId: invoice.id,
            customerId: session.user.id,
            amount: remainingAmount,
            method: "CREDIT_CARD",
            status: "PENDING",
            notes: `Müşteri paneli kredi kartı ödemesi (${invoice.invoiceNumber})`,
          },
        });
      } else if (Number(existingPendingPayment.amount) !== remainingAmount) {
        await db.payment.update({
          where: { id: existingPendingPayment.id },
          data: {
            amount: remainingAmount,
            notes: `Müşteri paneli kredi kartı ödemesi (${invoice.invoiceNumber})`,
          },
        });
      }

      const checkout = await initiateCreditCardPayment({
        customerId: session.user.id,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        amount: remainingAmount,
        context: "panel_invoice",
      });

      return {
        success: true,
        message: "Ödeme sayfasına yönlendiriliyorsunuz",
        data: {
          checkoutUrl: checkout.checkoutUrl,
          checkoutHtml: checkout.checkoutHtml,
          paytrToken: checkout.paytrToken,
          stripeSessionId: checkout.stripeSessionId,
          gatewayProvider: checkout.provider,
        },
      };
    }

    await db.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          customerId: session.user.id,
          amount: remainingAmount,
          method: input.paymentMethod,
          status: "PENDING",
          notes: `Banka havalesi bekleniyor (${invoice.invoiceNumber})`,
        },
      });

      await tx.emailMessage.create({
        data: {
          customerId: session.user.id,
          subject: `Banka Havalesi Bildirimi: ${invoice.invoiceNumber}`,
          preview: `${invoice.invoiceNumber} numaralı faturanız için havale bildiriminiz alındı.`,
          content: [
            "Merhaba,",
            "",
            `${invoice.invoiceNumber} numaralı faturanız için banka havalesi bildiriminiz alındı.`,
            `Beklenen tutar: ${currencyFormatter.format(remainingAmount)}`,
            `Bildirim tarihi: ${new Intl.DateTimeFormat("tr-TR").format(now)}`,
            "",
            "Ödeme onayı sonrası faturanız kapanacaktır.",
          ].join("\n"),
          category: "BILLING",
        },
      });
    });

    revalidatePath("/musteri/panel/faturalar");
    revalidatePath(`/musteri/panel/faturalar/${invoice.id}`);
    revalidatePath("/musteri/panel/e-posta");
    revalidatePath("/yonetim/faturalar");
    revalidatePath("/yonetim/faturalar/bekleyen");
    revalidatePath(`/yonetim/faturalar/${invoice.id}`);

    return {
      success: true,
      message:
        "Banka havalesi bildiriminiz alındı. Ödeme onayı sonrası fatura kapanacaktır.",
    };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "STRIPE_SECRET_KEY is not configured" ||
        error.message === "PAYMENT_GATEWAY_NOT_CONFIGURED")
    ) {
      return {
        success: false,
        error: "Kredi kartı ödemesi şu anda kullanılamıyor. Lütfen banka havalesi seçin.",
      };
    }

    return { success: false, error: "Ödeme sırasında bir hata oluştu" };
  }
}

export async function sendInvoiceCopy(invoiceId: string) {
  const session = await requireCustomer();

  if (!invoiceId) {
    return { success: false, error: "Fatura seçilmedi" };
  }

  try {
    const invoice = await db.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        invoiceNumber: true,
        customerId: true,
        status: true,
        totalAmount: true,
        dueDate: true,
        paidAt: true,
      },
    });

    if (!invoice) {
      return { success: false, error: "Fatura bulunamadı" };
    }

    if (invoice.customerId !== session.user.id) {
      return { success: false, error: "Bu faturaya erişim yetkiniz yok" };
    }

    await db.emailMessage.create({
      data: {
        customerId: session.user.id,
        subject: `Fatura Ozeti: ${invoice.invoiceNumber}`,
        preview: `${invoice.invoiceNumber} numarali faturanizin ozeti`,
        content: [
          "Merhaba,",
          "",
          `Fatura no: ${invoice.invoiceNumber}`,
          `Durum: ${invoice.status}`,
          `Tutar: ${currencyFormatter.format(Number(invoice.totalAmount))}`,
          `Son odeme tarihi: ${new Intl.DateTimeFormat("tr-TR").format(invoice.dueDate)}`,
          `Odeme tarihi: ${
            invoice.paidAt
              ? new Intl.DateTimeFormat("tr-TR").format(invoice.paidAt)
              : "-"
          }`,
        ].join("\n"),
        category: "BILLING",
      },
    });

    revalidatePath("/musteri/panel/e-posta");
    return { success: true, message: "Fatura ozeti e-posta kutunuza gonderildi" };
  } catch (error) {
    log.error("send invoice summary failed", { error });
    return { success: false, error: "Fatura ozeti gonderilemedi" };
  }
}