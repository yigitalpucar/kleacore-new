"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { createLogger } from "@/lib/logger";
import { parseMoney } from "@/lib/money";
import {
  RefundError,
  createRefund,
  resolvePendingRefund,
  type RefundMethodInput,
  type RefundOutcome,
  type RefundServiceAction,
} from "@/lib/payments/refunds";

const log = createLogger("admin.refunds");

export interface RefundFormInput {
  invoiceId: string;
  amount: string;
  reason: string;
  method: RefundMethodInput;
  serviceAction: RefundServiceAction;
  idempotencyKey: string;
  manualReference?: string;
}

type ActionResult =
  | { success: true; message: string; outcome: RefundOutcome }
  | { success: false; error: string };

const E_INVOICE_NOTES: Record<string, string> = {
  EARSIV_CANCELLED: " e-Arşiv fatura iptal edildi.",
  RETURN_INVOICE_REQUIRED: " Resmi fatura kesilmiş: iade faturası düzenlenmeli.",
};

function revalidateInvoice(invoiceId: string) {
  revalidatePath(`/yonetim/faturalar/${invoiceId}`);
  revalidatePath("/yonetim/faturalar");
  revalidatePath(`/musteri/panel/faturalar/${invoiceId}`);
  revalidatePath("/musteri/panel/faturalar");
}

function describe(outcome: RefundOutcome) {
  const eInvoice = outcome.eInvoiceAction ? E_INVOICE_NOTES[outcome.eInvoiceAction] ?? "" : "";
  if (outcome.status === "COMPLETED") return `İade tamamlandı. ${outcome.message}${eInvoice}`;
  if (outcome.status === "PENDING") {
    return `İade sonucu bilinmiyor: ${outcome.message} Sağlayıcı panelini kontrol edip iadeyi sonuçlandırın.`;
  }
  return outcome.message;
}

export async function createRefundAction(input: RefundFormInput): Promise<ActionResult> {
  const session = await requirePermission("payments.refund");

  const amount = parseMoney(input.amount);
  if (!amount) return { success: false, error: "İade tutarını girin." };

  try {
    const outcome = await createRefund({
      invoiceId: input.invoiceId,
      amount,
      reason: input.reason ?? "",
      method: input.method,
      serviceAction: input.serviceAction,
      idempotencyKey: input.idempotencyKey,
      createdBy: session.user.id,
      manualReference: input.manualReference,
    });
    revalidateInvoice(input.invoiceId);
    if (outcome.status === "FAILED") return { success: false, error: describe(outcome) };
    return { success: true, message: describe(outcome), outcome };
  } catch (error) {
    if (error instanceof RefundError) return { success: false, error: error.message };
    log.error("refund failed", { error, invoiceId: input.invoiceId });
    return { success: false, error: "İade yapılamadı." };
  }
}

export async function resolvePendingRefundAction(
  invoiceId: string,
  refundId: string,
  outcome: "COMPLETED" | "FAILED"
): Promise<ActionResult> {
  const session = await requirePermission("payments.refund");
  try {
    const result = await resolvePendingRefund(refundId, outcome, session.user.id);
    revalidateInvoice(invoiceId);
    return { success: true, message: describe(result), outcome: result };
  } catch (error) {
    if (error instanceof RefundError) return { success: false, error: error.message };
    log.error("resolve refund failed", { error, refundId });
    return { success: false, error: "İade güncellenemedi." };
  }
}
