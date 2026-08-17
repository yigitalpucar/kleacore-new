"use server";

import {
  AffiliatePayoutError,
  getAffiliateBalance,
  requestAffiliatePayout,
} from "@/lib/affiliate/payouts";
import { isValidPayoutIban } from "@/lib/affiliate/payouts";
import { db } from "@/lib/db";
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

export async function saveAffiliatePayoutIban(iban: string) {
  const session = await requireCustomer();
  const normalized = iban.replace(/\s+/g, "").toUpperCase();

  if (!isValidPayoutIban(normalized)) {
    return { success: false as const, error: "Geçerli bir IBAN girin (TR için 26 karakter)" };
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { affiliatePayoutIban: normalized },
  });

  revalidatePath("/musteri/panel/satis-ortakligi");
  revalidatePath("/yonetim/affiliate-odemeleri");

  return { success: true as const };
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