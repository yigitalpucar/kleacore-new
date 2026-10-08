"use server";

import { revalidatePath } from "next/cache";
import { requireCustomer } from "@/lib/utils/auth-helpers";
import { createLogger } from "@/lib/logger";
import { resolveCustomerPaymentMethod } from "@/lib/payments/payment-options";
import {
  BankTransferError,
  submitBankTransferNotice,
} from "@/lib/payments/bank-transfer/service";

const log = createLogger("customer.bank-transfer");

export interface BankTransferNoticeForm {
  invoiceId: string;
  amount: string;
  transferDate: string;
  senderName: string;
  bankAccountId?: string;
  note?: string;
}

/** "Ödeme bildirimi": the customer reports a havale/EFT for an open invoice. */
export async function submitBankTransferNoticeAction(input: BankTransferNoticeForm) {
  const session = await requireCustomer();

  const method = await resolveCustomerPaymentMethod("bank_transfer");
  if (!method.id) {
    return { success: false as const, error: "Havale/EFT şu anda kullanılamıyor" };
  }

  try {
    const notice = await submitBankTransferNotice({
      customerId: session.user.id,
      invoiceId: input.invoiceId,
      amount: input.amount,
      transferDate: input.transferDate,
      senderName: input.senderName ?? "",
      bankAccountId: input.bankAccountId || null,
      note: input.note,
    });

    revalidatePath(`/musteri/panel/faturalar/${input.invoiceId}`);
    revalidatePath("/musteri/panel/faturalar");
    revalidatePath("/yonetim/faturalar/havale-bildirimleri");
    return {
      success: true as const,
      message: `Ödeme bildiriminiz alındı. ${notice.invoiceNumber} onaylandığında e-posta ile bilgilendirileceksiniz.`,
    };
  } catch (error) {
    if (error instanceof BankTransferError) {
      return { success: false as const, error: error.message };
    }
    log.error("bank transfer notice failed", { error, invoiceId: input.invoiceId });
    return { success: false as const, error: "Ödeme bildirimi gönderilemedi" };
  }
}
