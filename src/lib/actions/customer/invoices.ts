"use server";

import { getPurchaseBlock } from "@/lib/auth/email-verification";
import { db } from "@/lib/db";
import { requireCustomer } from "@/lib/utils/auth-helpers";
import { revalidatePath } from "next/cache";
import {
  initiateCreditCardPayment,
  roundMoney,
} from "@/lib/payments/orchestrator";
import { resolveCustomerPaymentMethod } from "@/lib/payments/payment-options";
import {
  balancePaymentErrorMessage,
  payInvoicesWithBalance,
} from "@/lib/payments/balance-payment";
import { createLogger } from "@/lib/logger";
import { getPaymentBlock } from "@/lib/fraud/evaluate";
import { eq, max, sub } from "@/lib/money";

const log = createLogger("customer.invoices");

interface PayInvoiceInput {
  invoiceId: string;
  /** Method id from the picker ("kuveytturk", "paytr", "balance", …) or legacy "CREDIT_CARD". */
  paymentMethod: string;
}

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
});

function revalidateInvoicePaths(invoiceId: string) {
  revalidatePath("/musteri/panel/faturalar");
  revalidatePath(`/musteri/panel/faturalar/${invoiceId}`);
  revalidatePath("/yonetim/faturalar");
  revalidatePath(`/yonetim/faturalar/${invoiceId}`);
}

export async function payInvoice(input: PayInvoiceInput) {
  const session = await requireCustomer();

  const purchaseBlock = await getPurchaseBlock(session.user.id);
  if (purchaseBlock) {
    return purchaseBlock;
  }

  if (!input?.invoiceId) {
    return { success: false, error: "Fatura seçilmedi" };
  }

  const method = await resolveCustomerPaymentMethod(input.paymentMethod);
  if (!method.id) {
    return { success: false, error: "Seçilen ödeme yöntemi şu anda kullanılamıyor" };
  }

  if (method.id === "bank_transfer") {
    return {
      success: false,
      error: "Havale/EFT için banka bilgilerini kullanıp ödeme bildirimi gönderin",
    };
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

    if (invoice.status !== "PENDING" && invoice.status !== "OVERDUE") {
      return {
        success: false,
        error: invoice.status === "CANCELLED" ? "İptal edilmiş fatura ödenemez" : "Bu fatura zaten ödenmiş",
      };
    }

    // Order risk review (docs/fraud-kyc.md): blocked / rejected orders are not charged.
    const reviewBlock = await getPaymentBlock([invoice.id]);
    if (reviewBlock) {
      return { success: false, error: reviewBlock };
    }

    const remainingAmount = roundMoney(max(0, sub(invoice.totalAmount, invoice.paidAmount)));

    if (remainingAmount <= 0) {
      return { success: false, error: "Ödenecek tutar bulunamadı" };
    }

    if (method.id === "balance") {
      try {
        await payInvoicesWithBalance({
          customerId: session.user.id,
          invoiceIds: [invoice.id],
          performedBy: session.user.id,
        });
      } catch (error) {
        const message = balancePaymentErrorMessage(error);
        if (message) return { success: false, error: message };
        throw error;
      }
      revalidateInvoicePaths(invoice.id);
      revalidatePath("/musteri/panel/kredi");
      return {
        success: true,
        message: `${currencyFormatter.format(remainingAmount)} bakiyenizden düşüldü, faturanız ödendi`,
      };
    }

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
    } else if (!eq(existingPendingPayment.amount, remainingAmount)) {
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
      gateway: method.cardGateway ?? undefined,
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
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "STRIPE_SECRET_KEY is not configured" ||
        error.message === "PAYMENT_GATEWAY_NOT_CONFIGURED")
    ) {
      return {
        success: false,
        error: "Kartla ödeme şu anda kullanılamıyor. Lütfen başka bir ödeme yöntemi seçin.",
      };
    }

    log.error("invoice payment failed", { error, invoiceId: input.invoiceId });
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