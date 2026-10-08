"use server";

import { getPurchaseBlock } from "@/lib/auth/email-verification";
import { db } from "@/lib/db";
import { getAppBaseUrl, getStripe } from "@/lib/stripe";
import { requireCustomer } from "@/lib/utils/auth-helpers";
import { revalidatePath } from "next/cache";
import { compare, parseMoney, roundHalfUp, toFixed2, toKurus, toNumber } from "@/lib/money";

export async function initiateBalanceTopUp(amount: number | string) {
  const session = await requireCustomer();

  const purchaseBlock = await getPurchaseBlock(session.user.id);
  if (purchaseBlock) {
    return purchaseBlock;
  }

  try {
    const parsed = parseMoney(amount);
    if (!parsed || compare(parsed, 0) <= 0) {
      return { success: false, error: "Geçerli bir tutar girin" };
    }

    const normalizedAmount = roundHalfUp(parsed);

    if (compare(normalizedAmount, 50) < 0) {
      return { success: false, error: "Minimum yükleme tutarı 50 TL'dir" };
    }

    if (compare(normalizedAmount, 10000) > 0) {
      return { success: false, error: "Tek seferde en fazla 10.000 TL yüklenebilir" };
    }

    const stripe = getStripe();
    const baseUrl = getAppBaseUrl();

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${baseUrl}/musteri/panel/kredi?topup=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/musteri/panel/kredi?topup=cancelled`,
      metadata: {
        type: "balance_top_up",
        customerId: session.user.id,
        amount: toFixed2(normalizedAmount),
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "try",
            unit_amount: toKurus(normalizedAmount),
            product_data: {
              name: "KLEACORE Bakiye Yükleme",
              description: `${toFixed2(normalizedAmount)} TL bakiye yüklemesi`,
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
        amount: toNumber(normalizedAmount),
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