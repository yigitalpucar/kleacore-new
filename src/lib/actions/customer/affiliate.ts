"use server";

import {
  AffiliatePayoutError,
  getAffiliateBalance,
  requestAffiliatePayout,
} from "@/lib/affiliate/payouts";
import { requireCustomer } from "@/lib/utils/auth-helpers";
import { revalidatePath } from "next/cache";

function mapPayoutError(error: unknown) {
  if (error instanceof AffiliatePayoutError) {
    return { success: false as const, error: error.message };
  }

  return { success: false as const, error: "Ödeme talebi oluşturulamadı" };
}

export async function getAvailableAffiliateBalance() {
  const session = await requireCustomer();

  try {
    const balance = await getAffiliateBalance(session.user.id);
    return { success: true as const, data: { balance } };
  } catch {
    return { success: false as const, error: "Bakiye bilgisi alınamadı" };
  }
}

export async function requestPayout(amount: number) {
  const session = await requireCustomer();

  try {
    const payment = await requestAffiliatePayout(session.user.id, amount);

    revalidatePath("/musteri/panel/satis-ortakligi");

    return {
      success: true as const,
      data: {
        paymentId: payment.id,
        amount: payment.amount,
        status: payment.status,
      },
    };
  } catch (error) {
    return mapPayoutError(error);
  }
}