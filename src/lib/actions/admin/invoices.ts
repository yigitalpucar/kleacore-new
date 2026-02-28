"use server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import { generateInvoiceNumber } from "@/lib/utils/number-generators";
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

    const invoiceNumber = generateInvoiceNumber();

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

    revalidatePath("/yonetim/faturalar");
    return { success: true, data: { id: invoice.id, invoiceNumber } };
  } catch {
    return { success: false, error: "Fatura oluşturulurken bir hata oluştu" };
  }
}

export async function markPaid(id: string) {
  await requireAdmin();

  try {
    const invoice = await db.invoice.findUnique({ where: { id } });
    if (!invoice) {
      return { success: false, error: "Fatura bulunamadı" };
    }

    if (invoice.status === "PAID") {
      return { success: false, error: "Bu fatura zaten ödenmiş" };
    }

    if (invoice.status === "CANCELLED") {
      return { success: false, error: "İptal edilmiş fatura ödenemez" };
    }

    await db.invoice.update({
      where: { id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        paidAmount: invoice.totalAmount,
      },
    });

    revalidatePath("/yonetim/faturalar");
    return { success: true };
  } catch {
    return { success: false, error: "Fatura ödenirken bir hata oluştu" };
  }
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

    const fullName = `${invoice.customer.name} ${invoice.customer.surname}`.trim();
    const dueDateLabel = new Intl.DateTimeFormat("tr-TR").format(invoice.dueDate);
    const amountLabel = invoiceCurrencyFormatter.format(invoice.totalAmount);

    await db.emailMessage.create({
      data: {
        customerId: invoice.customer.id,
        subject: `Fatura Hatırlatması: ${invoice.invoiceNumber}`,
        preview: `${invoice.invoiceNumber} numaralı faturanız için ödeme hatırlatması`,
        content: [
          fullName ? `Merhaba ${fullName},` : "Merhaba,",
          "",
          `${invoice.invoiceNumber} numaralı faturanız için ödeme hatırlatmasıdır.`,
          `Son ödeme tarihi: ${dueDateLabel}`,
          `Toplam tutar: ${amountLabel}`,
          "",
          "Ödemenizi müşteri panelinizdeki fatura detayından tamamlayabilirsiniz.",
        ].join("\n"),
        category: "BILLING",
      },
    });

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

    await db.emailMessage.create({
      data: {
        customerId: invoice.customer.id,
        subject: `Ödeme Makbuzu: ${invoice.invoiceNumber}`,
        preview: `${invoice.invoiceNumber} numaralı faturanıza ait ödeme makbuzu`,
        content: [
          fullName ? `Merhaba ${fullName},` : "Merhaba,",
          "",
          `${invoice.invoiceNumber} numaralı faturanızın ödemesi başarıyla alınmıştır.`,
          `Ödeme tarihi: ${paidAtLabel}`,
          `Ödenen tutar: ${amountLabel}`,
          "",
          "Bu mesaj ödeme makbuzu niteliğindedir.",
        ].join("\n"),
        category: "BILLING",
      },
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
