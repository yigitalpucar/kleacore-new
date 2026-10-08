"use server";

import {
  cancelEInvoiceRecord,
  issueEInvoiceForInvoice,
  retryEInvoiceRecord,
  syncEInvoiceStatuses,
} from "@/lib/integrations/efatura";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import { revalidatePath } from "next/cache";

function failure(error: unknown, fallback: string) {
  return {
    success: false as const,
    error: error instanceof Error ? error.message : fallback,
  };
}

function revalidate(invoiceId?: string) {
  revalidatePath("/yonetim/efatura");
  if (invoiceId) revalidatePath(`/yonetim/faturalar/${invoiceId}`);
}

export async function retryEInvoiceRecordAction(recordId: string) {
  await requireAdmin();

  try {
    const record = await retryEInvoiceRecord(recordId);
    revalidate(record.invoiceId);
    return { success: true as const };
  } catch (error) {
    revalidate();
    return failure(error, "E-fatura yeniden gönderilemedi");
  }
}

/** Issue for a paid invoice that has no e-invoice record yet (e.g. paid before the module was enabled). */
export async function issueEInvoiceForInvoiceAction(invoiceId: string) {
  await requireAdmin();

  try {
    const outcome = await issueEInvoiceForInvoice(invoiceId);
    revalidate(invoiceId);
    if (outcome.ok) return { success: true as const };
    return { success: false as const, error: outcome.skipped ? outcome.reason : outcome.error };
  } catch (error) {
    return failure(error, "E-fatura kesilemedi");
  }
}

export async function syncEInvoiceStatusesAction() {
  await requireAdmin();

  try {
    const result = await syncEInvoiceStatuses({ limit: 100 });
    revalidate();
    return { success: true as const, ...result };
  } catch (error) {
    return failure(error, "Durumlar güncellenemedi");
  }
}

export async function cancelEInvoiceRecordAction(recordId: string, reason: string) {
  await requireAdmin();

  try {
    const record = await cancelEInvoiceRecord(recordId, reason);
    revalidate(record.invoiceId);
    return { success: true as const };
  } catch (error) {
    return failure(error, "E-Arşiv iptal edilemedi");
  }
}
