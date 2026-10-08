"use server";

import { db } from "@/lib/db";
import { requireCustomer } from "@/lib/utils/auth-helpers";
import {
  generateInvoiceNumber,
  generateOrderNumber,
} from "@/lib/utils/number-generators";
import { revalidatePath } from "next/cache";
import type { BillingPeriod } from "@prisma/client";
import {
  CUSTOMER_PAYMENT_METHODS,
  type CustomerPaymentMethod,
} from "@/lib/payments/methods";
import { initiateCreditCardPayment, isStripePaymentMethod } from "@/lib/payments/orchestrator";
import { calculateTax, getTaxRate } from "@/lib/billing/tax";

interface RenewServiceInput {
  serviceId: string;
  months: 1 | 3 | 6 | 12 | 24 | 36;
  paymentMethod: CustomerPaymentMethod;
}

const billingPeriodsByMonths: Record<RenewServiceInput["months"], BillingPeriod> = {
  1: "monthly",
  3: "quarterly",
  6: "semiannual",
  12: "yearly",
  24: "biennial",
  36: "triennial",
};

const renewalDiscountByMonths: Record<RenewServiceInput["months"], number> = {
  1: 0,
  3: 5,
  6: 10,
  12: 15,
  24: 20,
  36: 25,
};

const billingMonths: Record<BillingPeriod, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  yearly: 12,
  biennial: 24,
  triennial: 36,
};

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export async function renewService(input: RenewServiceInput) {
  const session = await requireCustomer();

  if (!CUSTOMER_PAYMENT_METHODS.includes(input.paymentMethod)) {
    return { success: false, error: "Geçersiz ödeme yöntemi" };
  }

  const renewalPeriod = billingPeriodsByMonths[input.months];
  const discountPercent = renewalDiscountByMonths[input.months];

  try {
    const service = await db.service.findUnique({
      where: { id: input.serviceId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
    });

    if (!service) {
      return { success: false, error: "Hizmet bulunamadı" };
    }

    if (service.customerId !== session.user.id) {
      return { success: false, error: "Bu hizmete erişim yetkiniz yok" };
    }

    if (service.status === "CANCELLED") {
      return { success: false, error: "İptal edilmiş hizmet yenilenemez" };
    }

    const currentPeriodMonths = billingMonths[service.billingPeriod] ?? 1;
    const monthlyPrice = Number(service.amount) / currentPeriodMonths;
    const subtotal = Number((monthlyPrice * input.months).toFixed(2));
    const discountAmount = Number(
      (subtotal * (discountPercent / 100)).toFixed(2)
    );
    const preTaxTotal = Number((subtotal - discountAmount).toFixed(2));
    const taxRate = await getTaxRate();
    const taxed = calculateTax(preTaxTotal, taxRate);
    const totalAmount = taxed.totalAmount;

    const now = new Date();
    const currentExpiry = service.nextDueDate ?? service.expiresAt ?? now;
    const renewalBaseDate =
      currentExpiry.getTime() > now.getTime() ? currentExpiry : now;
    const newExpiryDate = addMonths(renewalBaseDate, input.months);

    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 7);

    const isBankTransfer = input.paymentMethod === "BANK_TRANSFER";
    const isCreditCard = isStripePaymentMethod(input.paymentMethod);
    const isPaid = false;

    const transactionResult = await db.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber: await generateOrderNumber(),
          customerId: session.user.id,
          productId: service.productId,
          serviceId: service.id,
          domain: service.domain,
          billingPeriod: renewalPeriod,
          quantity: 1,
          basePrice: subtotal,
          discountAmount,
          setupFee: 0,
          taxRate: taxed.taxRate,
          taxAmount: taxed.taxAmount,
          totalAmount,
          status: isPaid ? "COMPLETED" : "PENDING",
          approvedAt: isPaid ? now : undefined,
          completedAt: isPaid ? now : undefined,
          customerNotes: isBankTransfer
            ? `Hizmet yenileme: ${input.months} ay (banka havalesi bekleniyor)`
            : `Hizmet yenileme: ${input.months} ay`,
          items: {
            create: {
              productName: `${service.product.name} Yenileme`,
              productSku: service.product.sku,
              quantity: 1,
              unitPrice: totalAmount,
              discountAmount,
              totalPrice: totalAmount,
              configuration: {
                serviceId: service.id,
                renewalMonths: input.months,
              },
            },
          },
        },
      });

      const invoice = await tx.invoice.create({
        data: {
          invoiceNumber: await generateInvoiceNumber(),
          customerId: session.user.id,
          orderId: order.id,
          subtotal: preTaxTotal,
          taxRate: taxed.taxRate,
          taxAmount: taxed.taxAmount,
          totalAmount,
          paidAmount: isPaid ? totalAmount : 0,
          status: isPaid ? "PAID" : "PENDING",
          dueDate,
          paidAt: isPaid ? now : undefined,
          notes: isBankTransfer
            ? `Hizmet yenileme (${input.months} ay) - banka havalesi bekleniyor`
            : `Hizmet yenileme (${input.months} ay)`,
          items: {
            create: {
              description: `${service.product.name} (${input.months} ay yenileme)`,
              quantity: 1,
              unitPrice: totalAmount,
              totalPrice: totalAmount,
            },
          },
        },
      });

      await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          customerId: session.user.id,
          amount: totalAmount,
          method: input.paymentMethod,
          status: "PENDING",
          notes: isBankTransfer
            ? `Hizmet yenileme (${input.months} ay) - banka havalesi bekleniyor`
            : `Hizmet yenileme (${input.months} ay)`,
          paidAt: isPaid ? now : undefined,
        },
      });

      await tx.orderActivity.create({
        data: {
          orderId: order.id,
          action: isBankTransfer ? "RENEWAL_PENDING" : "RENEWAL_CHECKOUT",
          description: isBankTransfer
            ? `Hizmet yenileme (${input.months} ay) banka havalesi bekliyor`
            : `Hizmet yenileme (${input.months} ay) kredi kartı ödemesi bekliyor`,
          performedBy: session.user.id,
          metadata: {
            serviceId: service.id,
            paymentMethod: input.paymentMethod,
            totalAmount,
            renewalMonths: input.months,
          },
        },
      });

      return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        orderId: order.id,
      };
    });

    if (isCreditCard) {
      const checkout = await initiateCreditCardPayment({
        customerId: session.user.id,
        invoiceId: transactionResult.invoiceId,
        invoiceNumber: transactionResult.invoiceNumber,
        amount: totalAmount,
        context: "panel_renewal",
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
          serviceId: service.id,
        },
      };
    }

    revalidatePath(`/musteri/panel/hizmetlerim/${service.id}`);
    revalidatePath(`/musteri/panel/hizmetlerim/${service.id}/yenile`);
    revalidatePath("/musteri/panel/hizmetlerim");
    revalidatePath("/musteri/panel/faturalar");
    revalidatePath("/yonetim/faturalar");
    revalidatePath("/yonetim/siparisler");

    return {
      success: true,
      message:
        "Yenileme faturanız oluşturuldu. Banka havalesi onayı sonrası süre uzatılacaktır.",
    };
  } catch (error) {
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

    return { success: false, error: "Hizmet yenilenirken bir hata oluştu" };
  }
}

