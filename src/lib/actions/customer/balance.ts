"use server";

import { db } from "@/lib/db";
import { getAppBaseUrl, getStripe } from "@/lib/stripe";
import { requireCustomer } from "@/lib/utils/auth-helpers";
import { revalidatePath } from "next/cache";

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

export async function initiateBalanceTopUp(amount: number) {
  const session = await requireCustomer();

  try {
    if (!amount || amount <= 0) {
      return { success: false, error: "Geçerli bir tutar girin" };
    }

    if (amount < 50) {
      return { success: false, error: "Minimum yükleme tutarı 50 TL'dir" };
    }

    if (amount > 10000) {
      return { success: false, error: "Tek seferde en fazla 10.000 TL yüklenebilir" };
    }

    const normalizedAmount = roundMoney(amount);
    const stripe = getStripe();
    const baseUrl = getAppBaseUrl();

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${baseUrl}/musteri/panel/kredi?topup=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/musteri/panel/kredi?topup=cancelled`,
      metadata: {
        type: "balance_top_up",
        customerId: session.user.id,
        amount: normalizedAmount.toString(),
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "try",
            unit_amount: Math.round(normalizedAmount * 100),
            product_data: {
              name: "KLEACORE Bakiye Yükleme",
              description: `${normalizedAmount.toFixed(2)} TL bakiye yüklemesi`,
            },
          },
        },
      ],
    });

    if (!checkoutSession.url) {
      return { success: false, error: "Ödeme oturumu oluşturulamadı" };
    }

    return {
      success: true,
      data: {
        checkoutUrl: checkoutSession.url,
        stripeSessionId: checkoutSession.id,
        amount: normalizedAmount,
      },
    };
  } catch {
    return { success: false, error: "Bakiye yükleme başlatılırken bir hata oluştu" };
  }
}

/** @deprecated Kanıtsız bakiye yükleme kaldırıldı. initiateBalanceTopUp kullanın. */
export async function loadBalance(_amount: number) {
  await requireCustomer();
  return {
    success: false,
    error:
      "Bakiye yalnızca kredi kartı ile yüklenebilir. Lütfen kredi kartı ödeme yöntemini seçin.",
  };
}