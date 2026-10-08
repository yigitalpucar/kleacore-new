"use server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import { generateInvoiceNumber } from "@/lib/utils/number-generators";
import { plainTextToHtml, sendTransactionalEmail } from "@/lib/mail";
import {
  dispatchNotification,
  loadCustomerRecipient,
  sendInvoiceCreatedEmail,
  sendInvoiceOverdueEmail,
  sendInvoicePaymentReminderEmail,
} from "@/lib/notifications/email";
import { fulfillInvoicePayment, notifyInvoicePaymentReceived } from "@/lib/payments/fulfillment";
import { runUnsuspendJobsForInvoices } from "@/lib/payments/service-lifecycle";
import { logActivity } from "@/lib/activity-log";
import { revalidatePath } from "next/cache";

interface InvoiceItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface InvoiceInput {
  customerId: string;
  orderId?: string;
  subtotal: number;
  taxRate?: number;
  taxAmount: number;
  totalAmount: number;
  dueDate: string;
  notes?: string;
  items: InvoiceItemInput[];
}

const invoiceCurrencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
});

export async function createInvoice(data: InvoiceInput) {
  await requireAdmin();

  try {
    const customer = await db.user.findUnique({
      where: { id: data.customerId },
    });
    if (!customer) {
      return { success: false, error: "Müşteri bulunamadı" };
    }

    const invoiceNumber = await generateInvoiceNumber();

    const invoice = await db.invoice.create({
      data: {
        invoiceNumber,
        customerId: data.customerId,
        orderId: data.orderId ?? null,
        subtotal: data.subtotal,
        taxRate: data.taxRate ?? 20,
        taxAmount: data.taxAmount,
        totalAmount: data.totalAmount,
        status: "PENDING",
        dueDate: new Date(data.dueDate),
        notes: data.notes ?? null,
        items: {
          create: data.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
          })),
        },
      },
    });

    dispatchNotification(async () => {
      const recipient = await loadCustomerRecipient(data.customerId);
      if (!recipient) {
        return;
      }

      await sendInvoiceCreatedEmail({
        customer: recipient,
        invoiceId: invoice.id,
        invoiceNumber,
        totalAmount: data.totalAmount,
        dueDate: new Date(data.dueDate),
      });
    });

    revalidatePath("/yonetim/faturalar");
    revalidatePath("/musteri/panel/faturalar");
    revalidatePath("/musteri/panel/e-posta");
    return { success: true, data: { id: invoice.id, invoiceNumber } };
  } catch {
    return { success: false, error: "Fatura oluşturulurken bir hata oluştu" };
  }
}

async function fulfillInvoiceAsAdmin(
  id: string,
  performedBy: string,
  notes: string
) {
  const invoice = await db.invoice.findUnique({
    where: { id },
  });

  if (!invoice) {
    return { success: false as const, error: "Fatura bulunamadı" };
  }

  if (invoice.status === "PAID") {
    return { success: false as const, error: "Bu fatura zaten ödenmiş" };
  }

  if (invoice.status === "CANCELLED") {
    return { success: false as const, error: "İptal edilmiş fatura ödenemez" };
  }

  await db.$transaction(async (tx) => {
    await fulfillInvoicePayment(tx, {
      invoiceId: id,
      performedBy,
      notes,
    });
  });

  await logActivity({
    userId: performedBy,
    action: "INVOICE_PAID",
    entity: "Invoice",
    entityId: id,
    details: {
      invoiceNumber: invoice.invoiceNumber,
      totalAmount: Number(invoice.totalAmount),
      notes,
    },
  });

  await runUnsuspendJobsForInvoices([id]);

  dispatchNotification(() => notifyInvoicePaymentReceived(id));

  revalidatePath("/yonetim/faturalar");
  revalidatePath(`/yonetim/faturalar/${id}`);
  revalidatePath("/yonetim/siparisler");
  revalidatePath("/yonetim/hizmetler");
  revalidatePath("/musteri/panel/faturalar");
  revalidatePath(`/musteri/panel/faturalar/${id}`);
  revalidatePath("/musteri/panel/hizmetlerim");
  revalidatePath("/musteri/panel/domainler");
  revalidatePath("/yonetim/aktivite");

  return { success: true as const };
}

export async function markPaid(id: string) {
  const session = await requireAdmin();

  try {
    return await fulfillInvoiceAsAdmin(id, session.user.id, "Admin ödeme onayı");
  } catch {
    return { success: false, error: "Fatura ödenirken bir hata oluştu" };
  }
}

export async function approveBankTransfer(id: string) {
  const session = await requireAdmin();

  try {
    const invoice = await db.invoice.findUnique({
      where: { id },
      include: {
        payments: {
          where: {
            method: "BANK_TRANSFER",
            status: "PENDING",
          },
        },
      },
    });

    if (!invoice) {
      return { success: false, error: "Fatura bulunamadı" };
    }

    if (invoice.payments.length === 0) {
      return {
        success: false,
        error: "Bu fatura için onay bekleyen banka transferi ödemesi bulunamadı",
      };
    }

    return await fulfillInvoiceAsAdmin(
      id,
      session.user.id,
      "Banka transferi admin onayı"
    );
  } catch {
    return { success: false, error: "Banka transferi onaylanırken bir hata oluştu" };
  }
}

export async function markInvoicePaid(id: string) {
  return approveBankTransfer(id);
}

export async function cancelInvoice(id: string) {
  await requireAdmin();

  try {
    const invoice = await db.invoice.findUnique({ where: { id } });
    if (!invoice) {
      return { success: false, error: "Fatura bulunamadı" };
    }

    if (invoice.status === "PAID") {
      return { success: false, error: "Ödenmiş fatura iptal edilemez" };
    }

    await db.invoice.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    revalidatePath("/yonetim/faturalar");
    return { success: true };
  } catch {
    return { success: false, error: "Fatura iptal edilirken bir hata oluştu" };
  }
}

export async function sendInvoiceReminder(id: string) {
  await requireAdmin();

  try {
    const invoice = await db.invoice.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            surname: true,
            email: true,
          },
        },
      },
    });

    if (!invoice) {
      return { success: false, error: "Fatura bulunamadı" };
    }

    if (invoice.status === "PAID") {
      return { success: false, error: "Ödenmiş fatura için hatırlatma gönderilemez" };
    }

    if (invoice.status === "CANCELLED") {
      return { success: false, error: "İptal edilmiş fatura için hatırlatma gönderilemez" };
    }

    const isOverdue =
      invoice.status === "OVERDUE" || invoice.dueDate.getTime() < Date.now();

    await (isOverdue
      ? sendInvoiceOverdueEmail({
          customer: {
            customerId: invoice.customer.id,
            email: invoice.customer.email,
            fullName: `${invoice.customer.name} ${invoice.customer.surname}`.trim(),
          },
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          totalAmount: Number(invoice.totalAmount),
          dueDate: invoice.dueDate,
        })
      : sendInvoicePaymentReminderEmail({
          customer: {
            customerId: invoice.customer.id,
            email: invoice.customer.email,
            fullName: `${invoice.customer.name} ${invoice.customer.surname}`.trim(),
          },
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          totalAmount: Number(invoice.totalAmount),
          dueDate: invoice.dueDate,
        }));

    revalidatePath("/yonetim/faturalar");
    revalidatePath("/yonetim/faturalar/bekleyen");
    revalidatePath("/yonetim/faturalar/gecikmis");
    revalidatePath("/yonetim/faturalar/tum-faturalar");
    revalidatePath(`/yonetim/faturalar/${id}`);
    revalidatePath("/musteri/panel/faturalar");
    revalidatePath(`/musteri/panel/faturalar/${id}`);
    revalidatePath("/musteri/panel/e-posta");

    return { success: true, message: "Hatırlatma gönderildi" };
  } catch {
    return { success: false, error: "Hatırlatma gönderilirken bir hata oluştu" };
  }
}

export async function sendInvoiceReceipt(id: string) {
  await requireAdmin();

  try {
    const invoice = await db.invoice.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            surname: true,
            email: true,
          },
        },
      },
    });

    if (!invoice) {
      return { success: false, error: "Fatura bulunamadı" };
    }

    if (invoice.status !== "PAID") {
      return { success: false, error: "Makbuz sadece ödenmiş faturalar için gönderilebilir" };
    }

    const fullName = `${invoice.customer.name} ${invoice.customer.surname}`.trim();
    const paidAtLabel = new Intl.DateTimeFormat("tr-TR").format(
      invoice.paidAt ?? invoice.updatedAt
    );
    const paidAmount = Math.max(Number(invoice.paidAmount), Number(invoice.totalAmount));
    const amountLabel = invoiceCurrencyFormatter.format(paidAmount);

    const content = [
      fullName ? `Merhaba ${fullName},` : "Merhaba,",
      "",
      `${invoice.invoiceNumber} numaralı faturanızın ödemesi başarıyla alınmıştır.`,
      `Ödeme tarihi: ${paidAtLabel}`,
      `Ödenen tutar: ${amountLabel}`,
      "",
      "Bu mesaj ödeme makbuzu niteliğindedir.",
    ].join("\n");

    await db.emailMessage.create({
      data: {
        customerId: invoice.customer.id,
        subject: `Ödeme Makbuzu: ${invoice.invoiceNumber}`,
        preview: `${invoice.invoiceNumber} numaralı faturanıza ait ödeme makbuzu`,
        content,
        category: "BILLING",
      },
    });

    await sendTransactionalEmail({
      to: invoice.customer.email,
      subject: `Ödeme Makbuzu: ${invoice.invoiceNumber}`,
      text: content,
      html: plainTextToHtml(content),
    });

    revalidatePath("/yonetim/faturalar");
    revalidatePath("/yonetim/faturalar/odendi");
    revalidatePath("/yonetim/faturalar/tum-faturalar");
    revalidatePath(`/yonetim/faturalar/${id}`);
    revalidatePath("/musteri/panel/faturalar");
    revalidatePath(`/musteri/panel/faturalar/${id}`);
    revalidatePath("/musteri/panel/e-posta");

    return { success: true, message: "Makbuz gönderildi" };
  } catch {
    return { success: false, error: "Makbuz gönderilirken bir hata oluştu" };
  }
}
