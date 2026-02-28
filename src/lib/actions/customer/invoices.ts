"use server";

import { db } from "@/lib/db";
import { requireCustomer } from "@/lib/utils/auth-helpers";
import { revalidatePath } from "next/cache";
import type { PaymentMethod } from "@prisma/client";

interface PayInvoiceInput {
  invoiceId: string;
  paymentMethod: PaymentMethod;
}

const allowedPaymentMethods: PaymentMethod[] = [
  "CREDIT_CARD",
  "BALANCE",
  "BANK_TRANSFER",
];

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

    const remainingAmount = Number(
      Math.max(0, Number(invoice.totalAmount) - Number(invoice.paidAmount)).toFixed(2)
    );

    if (remainingAmount <= 0) {
      return { success: false, error: "Ödenecek tutar bulunamadı" };
    }

    const now = new Date();

    await db.$transaction(async (tx) => {
      if (input.paymentMethod === "BALANCE") {
        const customer = await tx.user.findUnique({
          where: { id: session.user.id },
          select: { balance: true, name: true, surname: true },
        });

        if (!customer) {
          throw new Error("CUSTOMER_NOT_FOUND");
        }

        if (customer.balance < remainingAmount) {
          throw new Error("INSUFFICIENT_BALANCE");
        }

        const balanceBefore = Number(customer.balance);
        const balanceAfter = Number((balanceBefore - remainingAmount).toFixed(2));

        await tx.user.update({
          where: { id: session.user.id },
          data: { balance: balanceAfter },
        });

        await tx.transaction.create({
          data: {
            customerId: session.user.id,
            type: "PAYMENT",
            amount: remainingAmount,
            balanceBefore,
            balanceAfter,
            description: `Fatura odemesi (${invoice.invoiceNumber})`,
            referenceId: invoice.id,
          },
        });
      }

      await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          customerId: session.user.id,
          amount: remainingAmount,
          method: input.paymentMethod,
          status: "COMPLETED",
          transactionId:
            input.paymentMethod === "CREDIT_CARD" ? `CC-${Date.now()}` : undefined,
          notes: `Musteri paneli odemesi (${invoice.invoiceNumber})`,
          paidAt: now,
        },
      });

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          status: "PAID",
          paidAt: now,
          paidAmount: Number((Number(invoice.paidAmount) + remainingAmount).toFixed(2)),
        },
      });

      await tx.emailMessage.create({
        data: {
          customerId: session.user.id,
          subject: `Fatura Odemesi Tamamlandi: ${invoice.invoiceNumber}`,
          preview: `${invoice.invoiceNumber} numarali faturanizin odemesi alindi.`,
          content: [
            "Merhaba,",
            "",
            `${invoice.invoiceNumber} numarali faturanizin odemesi basariyla alindi.`,
            `Odenen tutar: ${currencyFormatter.format(remainingAmount)}`,
            `Odeme tarihi: ${new Intl.DateTimeFormat("tr-TR").format(now)}`,
            "",
            "Tesekkur ederiz.",
          ].join("\n"),
          category: "BILLING",
        },
      });
    });

    revalidatePath("/musteri/panel/faturalar");
    revalidatePath(`/musteri/panel/faturalar/${invoice.id}`);
    revalidatePath("/musteri/panel/e-posta");
    revalidatePath("/musteri/panel/kredi");
    revalidatePath("/yonetim/faturalar");
    revalidatePath("/yonetim/faturalar/odendi");
    revalidatePath("/yonetim/faturalar/bekleyen");
    revalidatePath("/yonetim/faturalar/gecikmis");
    revalidatePath(`/yonetim/faturalar/${invoice.id}`);

    return { success: true, message: "Fatura odemesi tamamlandi" };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "CUSTOMER_NOT_FOUND") {
        return { success: false, error: "Kullanici bulunamadi" };
      }
      if (error.message === "INSUFFICIENT_BALANCE") {
        return { success: false, error: "Yetersiz bakiye. Lutfen bakiye yukleyin." };
      }
    }

    return { success: false, error: "Odeme sirasinda bir hata olustu" };
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
  } catch {
    return { success: false, error: "Fatura ozeti gonderilemedi" };
  }
}
