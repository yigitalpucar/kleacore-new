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
import {
  dispatchSmsNotification,
  sendSmsNotification,
} from "@/lib/notifications/sms";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import { revalidatePath } from "next/cache";

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
  const session = await requireAdmin();

  try {
    await approveAffiliatePayout(paymentId, session.user.id);
    revalidateAffiliatePayoutPaths();
    return { success: true as const };
  } catch (error) {
    return mapPayoutError(error);
  }
}

export async function rejectPayout(paymentId: string, reason?: string) {
  const session = await requireAdmin();

  try {
    await rejectAffiliatePayout(paymentId, session.user.id, reason);
    revalidateAffiliatePayoutPaths();
    return { success: true as const };
  } catch (error) {
    return mapPayoutError(error);
  }
}

export async function completePayout(paymentId: string, notes?: string) {
  const session = await requireAdmin();

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
        amount: payment.amount,
        paidAt: payment.paidAt ?? new Date(),
      });
    });

    dispatchSmsNotification(async () => {
      await sendSmsNotification({
        customerId: payment.affiliateId,
        template: "custom",
        message: `Satış ortaklığı ödemeniz tamamlandı: ${payment.amount.toFixed(2)} TL`,
      });
    });

    revalidateAffiliatePayoutPaths();
    return { success: true as const };
  } catch (error) {
    return mapPayoutError(error);
  }
}