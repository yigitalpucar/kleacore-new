"use server";

import { retryEInvoiceRecord } from "@/lib/integrations/efatura";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import { revalidatePath } from "next/cache";

export async function retryEInvoiceRecordAction(recordId: string) {
  await requireAdmin();

  try {
    await retryEInvoiceRecord(recordId);
    revalidatePath("/yonetim/efatura");
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "E-fatura yeniden gönderilemedi",
    };
  }
}