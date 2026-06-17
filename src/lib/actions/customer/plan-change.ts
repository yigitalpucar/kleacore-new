"use server";

import { revalidatePath } from "next/cache";
import { requireCustomer } from "@/lib/utils/auth-helpers";
import {
  CUSTOMER_PAYMENT_METHODS,
  type CustomerPaymentMethod,
} from "@/lib/payments/methods";
import { initiateCreditCardPayment, isStripePaymentMethod } from "@/lib/payments/orchestrator";
import { requestPlanChange } from "@/lib/services/plan-change";

interface RequestPlanChangeInput {
  serviceId: string;
  targetProductSku: string;
  paymentMethod?: CustomerPaymentMethod;
}

const errorMessages: Record<string, string> = {
  SERVICE_NOT_FOUND: "Hizmet bulunamadı",
  SERVICE_ACCESS_DENIED: "Bu hizmete erişim yetkiniz yok",
  SERVICE_NOT_ACTIVE: "Yalnızca aktif hizmetlerde paket değişikliği yapılabilir",
  TARGET_PRODUCT_NOT_FOUND: "Hedef paket bulunamadı",
  SAME_PRODUCT: "Zaten bu paketi kullanıyorsunuz",
  PLAN_CHANGE_ALREADY_PENDING: "Bekleyen bir paket değişikliği talebiniz var",
};

export async function submitPlanChange(input: RequestPlanChangeInput) {
  const session = await requireCustomer();

  if (input.paymentMethod && !CUSTOMER_PAYMENT_METHODS.includes(input.paymentMethod)) {
    return { success: false, error: "Geçersiz ödeme yöntemi" };
  }

  try {
    const result = await requestPlanChange({
      serviceId: input.serviceId,
      targetProductSku: input.targetProductSku,
      customerId: session.user.id,
      paymentMethod: input.paymentMethod,
    });

    if (result.requiresApproval) {
      revalidatePath(`/musteri/panel/hizmetlerim/${input.serviceId}`);
      revalidatePath(`/musteri/panel/hizmetlerim/${input.serviceId}/yukselt`);
      revalidatePath("/yonetim/siparisler/yukseltme-dusurme");

      return {
        success: true,
        message: "Düşürme talebiniz alındı. Yönetici onayı sonrası uygulanacaktır.",
        data: {
          planChangeId: result.planChangeId,
          type: result.type,
          requiresApproval: true,
        },
      };
    }

    if (result.requiresPayment && result.invoiceId && result.invoiceNumber) {
      const isCreditCard = isStripePaymentMethod(input.paymentMethod ?? "CREDIT_CARD");

      if (isCreditCard) {
        const checkout = await initiateCreditCardPayment({
          customerId: session.user.id,
          invoiceId: result.invoiceId,
          invoiceNumber: result.invoiceNumber,
          amount: result.totalAmount,
          context: "panel_invoice",
        });

        return {
          success: true,
          message: "Ödeme sayfasına yönlendiriliyorsunuz",
          data: {
            checkoutUrl: checkout.checkoutUrl,
            checkoutHtml: checkout.checkoutHtml,
            paytrToken: checkout.paytrToken,
            stripeSessionId: checkout.stripeSessionId,
            gatewayProvider: checkout.provider,
            planChangeId: result.planChangeId,
            type: result.type,
          },
        };
      }
    }

    revalidatePath(`/musteri/panel/hizmetlerim/${input.serviceId}`);
    revalidatePath(`/musteri/panel/hizmetlerim/${input.serviceId}/yukselt`);
    revalidatePath("/musteri/panel/faturalar");
    revalidatePath("/yonetim/siparisler/yukseltme-dusurme");

    return {
      success: true,
      message:
        result.type === "UPGRADE"
          ? "Yükseltme faturanız oluşturuldu. Ödeme sonrası paket güncellenecektir."
          : "Paket değişikliği talebiniz alındı",
      data: {
        planChangeId: result.planChangeId,
        type: result.type,
      },
    };
  } catch (error) {
    if (error instanceof Error && errorMessages[error.message]) {
      return { success: false, error: errorMessages[error.message] };
    }

    if (
      error instanceof Error &&
      (error.message === "STRIPE_SECRET_KEY is not configured" ||
        error.message === "PAYMENT_GATEWAY_NOT_CONFIGURED")
    ) {
      return {
        success: false,
        error: "Kredi kartı ödemesi şu anda kullanılamıyor. Lütfen banka havalesi seçin.",
      };
    }

    return { success: false, error: "Paket değişikliği talebi oluşturulamadı" };
  }
}