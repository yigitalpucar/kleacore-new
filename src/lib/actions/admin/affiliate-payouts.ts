"use server";

import {
  AffiliatePayoutError,
  approveAffiliatePayout,
  completeAffiliatePayout,
  rejectAffiliatePayout,
} from "@/lib/affiliate/payouts";
import {
  dispatchNotification,
  loadCustomerRecipient,
  sendAffiliatePayoutCompletedEmail,
} from "@/lib/notifications/email";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { revalidatePath } from "next/cache";
import { toNumber } from "@/lib/money";

function revalidateAffiliatePayoutPaths() {
  revalidatePath("/yonetim/affiliate-odemeleri");
  revalidatePath("/musteri/panel/satis-ortakligi");
}

function mapPayoutError(error: unknown) {
  if (error instanceof AffiliatePayoutError) {
    return { success: false as const, error: error.message };
  }

  return { success: false as const, error: "İşlem tamamlanamadı" };
}

export async function approvePayout(paymentId: string) {
  const session = await requirePermission("invoices.edit");

  try {
    await approveAffiliatePayout(paymentId, session.user.id);
    revalidateAffiliatePayoutPaths();
    return { success: true as const };
  } catch (error) {
    return mapPayoutError(error);
  }
}

export async function rejectPayout(paymentId: string, reason?: string) {
  const session = await requirePermission("invoices.edit");

  try {
    await rejectAffiliatePayout(paymentId, session.user.id, reason);
    revalidateAffiliatePayoutPaths();
    return { success: true as const };
  } catch (error) {
    return mapPayoutError(error);
  }
}

export async function completePayout(paymentId: string, notes?: string) {
  const session = await requirePermission("invoices.edit");

  try {
    const payment = await completeAffiliatePayout(
      paymentId,
      session.user.id,
      notes
    );

    dispatchNotification(async () => {
      const customer = await loadCustomerRecipient(payment.affiliateId);
      if (!customer) {
        return;
      }

      await sendAffiliatePayoutCompletedEmail({
        customer,
        paymentId: payment.id,
        amount: toNumber(payment.amount),
        paidAt: payment.paidAt ?? new Date(),
      });
    });

    revalidateAffiliatePayoutPaths();
    return { success: true as const };
  } catch (error) {
    return mapPayoutError(error);
  }
}