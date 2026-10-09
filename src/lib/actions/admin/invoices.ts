"use server";

import { db } from "@/lib/db";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { sendNotification } from "@/lib/notifications/send";
import { emitEvent } from "@/lib/events/emit";
import {
  createInvoiceAs,
  fulfillInvoiceAsAdmin as fulfillInvoiceAsStaff,
  sendInvoiceReminderFor,
  type InvoiceInput,
} from "@/lib/billing/admin-invoices";
import { approveBankTransferNotice } from "@/lib/payments/bank-transfer/service";
import { revalidatePath } from "next/cache";
import { createLogger } from "@/lib/logger";
import { max as maxMoney, toNumber } from "@/lib/money";

const log = createLogger("admin.invoices");

export async function createInvoice(data: InvoiceInput) {
  const session = await requirePermission("invoices.edit");

  try {
    const result = await createInvoiceAs(session.user.id, data);
    if (!result.success) return result;

    revalidatePath("/yonetim/faturalar");
    revalidatePath("/musteri/panel/faturalar");
    revalidatePath("/musteri/panel/e-posta");
    return result;
  } catch (error) {
    log.error("create invoice failed", { error });
    return { success: false as const, error: "Fatura oluşturulurken bir hata oluştu" };
  }
}

async function fulfillInvoiceAsAdmin(
  id: string,
  performedBy: string,
  notes: string
) {
  const result = await fulfillInvoiceAsStaff(id, performedBy, notes);
  if (!result.success) return result;

  revalidatePath("/yonetim/faturalar");
  revalidatePath(`/yonetim/faturalar/${id}`);
  revalidatePath("/yonetim/siparisler");
  revalidatePath("/yonetim/hizmetler");
  revalidatePath("/musteri/panel/faturalar");
  revalidatePath(`/musteri/panel/faturalar/${id}`);
  revalidatePath("/musteri/panel/hizmetlerim");
  revalidatePath("/musteri/panel/domainler");
  revalidatePath("/yonetim/aktivite");

  return { success: true as const, warning: result.warning };
}

export async function markPaid(id: string) {
  const session = await requirePermission("invoices.edit");

  try {
    return await fulfillInvoiceAsAdmin(id, session.user.id, "Admin ödeme onayı");
  } catch (error) {
    log.error("mark invoice paid failed", { error });
    return { success: false, error: "Fatura ödenirken bir hata oluştu" };
  }
}

export async function approveBankTransfer(id: string) {
  const session = await requirePermission("bank_transfers.approve");

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

    // A customer "ödeme bildirimi" is approved through the havale module so
    // the notice is closed together with the invoice.
    const notice = await db.bankTransferNotice.findFirst({
      where: { invoiceId: id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (notice) {
      await approveBankTransferNotice(notice.id, session.user.id);
      revalidatePath("/yonetim/faturalar");
      revalidatePath(`/yonetim/faturalar/${id}`);
      revalidatePath("/yonetim/faturalar/havale-bildirimleri");
      revalidatePath(`/musteri/panel/faturalar/${id}`);
      return { success: true as const };
    }

    return await fulfillInvoiceAsAdmin(
      id,
      session.user.id,
      "Banka transferi admin onayı"
    );
  } catch (error) {
    log.error("approve bank transfer failed", { error });
    return { success: false, error: "Banka transferi onaylanırken bir hata oluştu" };
  }
}

export async function markInvoicePaid(id: string) {
  await requirePermission("bank_transfers.approve");
  return approveBankTransfer(id);
}

export async function cancelInvoice(id: string) {
  const session = await requirePermission("invoices.edit");

  try {
    const invoice = await db.invoice.findUnique({ where: { id } });
    if (!invoice) {
      return { success: false, error: "Fatura bulunamadı" };
    }

    if (invoice.status === "PAID") {
      return { success: false, error: "Ödenmiş fatura iptal edilemez" };
    }

    await db.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id },
        data: { status: "CANCELLED" },
      });
      await emitEvent(
        tx,
        "invoice.cancelled",
        { invoiceId: id, invoiceNumber: invoice.invoiceNumber, customerId: invoice.customerId },
        { actorId: session.user.id }
      );
    });

    revalidatePath("/yonetim/faturalar");
    return { success: true };
  } catch (error) {
    log.error("cancel invoice failed", { error });
    return { success: false, error: "Fatura iptal edilirken bir hata oluştu" };
  }
}

export async function sendInvoiceReminder(id: string) {
  await requirePermission("invoices.edit");

  try {
    const result = await sendInvoiceReminderFor(id);
    if (!result.success) return result;

    revalidatePath("/yonetim/faturalar");
    revalidatePath("/yonetim/faturalar/bekleyen");
    revalidatePath("/yonetim/faturalar/gecikmis");
    revalidatePath("/yonetim/faturalar/tum-faturalar");
    revalidatePath(`/yonetim/faturalar/${id}`);
    revalidatePath("/musteri/panel/faturalar");
    revalidatePath(`/musteri/panel/faturalar/${id}`);
    revalidatePath("/musteri/panel/e-posta");

    return result;
  } catch (error) {
    log.error("send invoice reminder failed", { error });
    return { success: false as const, error: "Hatırlatma gönderilirken bir hata oluştu" };
  }
}

export async function sendInvoiceReceipt(id: string) {
  await requirePermission("invoices.edit");

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

    // Manual "makbuz gönder": explicit resend, so no dedupe key.
    await sendNotification({
      userId: invoice.customer.id,
      template: "billing.payment-received",
      data: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        paidAmount: toNumber(maxMoney(invoice.paidAmount, invoice.totalAmount)),
        paidAt: invoice.paidAt ?? invoice.updatedAt,
        receipt: true,
      },
      channel: "EMAIL",
    });

    revalidatePath("/yonetim/faturalar");
    revalidatePath("/yonetim/faturalar/odendi");
    revalidatePath("/yonetim/faturalar/tum-faturalar");
    revalidatePath(`/yonetim/faturalar/${id}`);
    revalidatePath("/musteri/panel/faturalar");
    revalidatePath(`/musteri/panel/faturalar/${id}`);
    revalidatePath("/musteri/panel/e-posta");

    return { success: true, message: "Makbuz gönderildi" };
  } catch (error) {
    log.error("send receipt failed", { error });
    return { success: false, error: "Makbuz gönderilirken bir hata oluştu" };
  }
}
