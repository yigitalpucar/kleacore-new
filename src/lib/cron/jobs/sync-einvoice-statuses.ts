import { syncEInvoiceStatuses } from "@/lib/integrations/efatura";

/** Batch per run; the oldest-checked SENT documents go first (see syncEInvoiceStatuses). */
const BATCH_LIMIT = 100;

/** Every 15 min: poll Uyumsoft for e-Fatura/e-Arşiv documents still in flight (SENT). */
export async function syncEInvoiceStatusesJob() {
  return syncEInvoiceStatuses({ limit: BATCH_LIMIT });
}
