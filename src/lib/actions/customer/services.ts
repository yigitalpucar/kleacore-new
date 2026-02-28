"use server";

import { db } from "@/lib/db";
import { requireCustomer } from "@/lib/utils/auth-helpers";
import {
  generateInvoiceNumber,
  generateOrderNumber,
} from "@/lib/utils/number-generators";
import { revalidatePath } from "next/cache";
import type { BillingPeriod, PaymentMethod } from "@prisma/client";

interface RenewServiceInput {
  serviceId: string;
  months: 1 | 3 | 6 | 12 | 24 | 36;
  paymentMethod: PaymentMethod;
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
    const totalAmount = Number((subtotal - discountAmount).toFixed(2));

    const now = new Date();
    const currentExpiry = service.nextDueDate ?? service.expiresAt ?? now;
    const renewalBaseDate =
      currentExpiry.getTime() > now.getTime() ? currentExpiry : now;
    const newExpiryDate = addMonths(renewalBaseDate, input.months);

    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 7);

    await db.$transaction(async (tx) => {
      const customer = await tx.user.findUnique({
        where: { id: session.user.id },
        select: { balance: true },
      });

      if (!customer) {
        throw new Error("CUSTOMER_NOT_FOUND");
      }

      if (input.paymentMethod === "BALANCE" && customer.balance < totalAmount) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      const order = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          customerId: session.user.id,
          productId: service.productId,
          serviceId: service.id,
          domain: service.domain,
          billingPeriod: renewalPeriod,
          quantity: 1,
          basePrice: subtotal,
          discountAmount,
          setupFee: 0,
          taxRate: 0,
          taxAmount: 0,
          totalAmount,
          status: "COMPLETED",
          approvedAt: now,
          completedAt: now,
          customerNotes: `Hizmet yenileme: ${input.months} ay`,
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
          invoiceNumber: generateInvoiceNumber(),
          customerId: session.user.id,
          orderId: order.id,
          subtotal: totalAmount,
          taxRate: 0,
          taxAmount: 0,
          totalAmount,
          paidAmount: totalAmount,
          status: "PAID",
          dueDate,
          paidAt: now,
          notes: `Hizmet yenileme (${input.months} ay)`,
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
          status: "COMPLETED",
          transactionId:
            input.paymentMethod === "CREDIT_CARD"
              ? `CC-${Date.now()}`
              : undefined,
          notes: `Hizmet yenileme (${input.months} ay)`,
          paidAt: now,
        },
      });

      if (input.paymentMethod === "BALANCE") {
        const balanceBefore = customer.balance;
        const balanceAfter = Number((balanceBefore - totalAmount).toFixed(2));

        await tx.user.update({
          where: { id: session.user.id },
          data: { balance: balanceAfter },
        });

        await tx.transaction.create({
          data: {
            customerId: session.user.id,
            type: "PAYMENT",
            amount: totalAmount,
            balanceBefore,
            balanceAfter,
            description: `Hizmet yenileme ödemesi (${input.months} ay)`,
            referenceId: invoice.id,
          },
        });
      }

      await tx.service.update({
        where: { id: service.id },
        data: {
          status: "ACTIVE",
          billingPeriod: renewalPeriod,
          amount: totalAmount,
          nextDueDate: newExpiryDate,
          expiresAt: newExpiryDate,
          suspendedAt: null,
          suspendReason: null,
        },
      });

      await tx.orderActivity.create({
        data: {
          orderId: order.id,
          action: "RENEWED",
          description: `Hizmet ${input.months} ay yenilendi`,
          performedBy: session.user.id,
          metadata: {
            serviceId: service.id,
            paymentMethod: input.paymentMethod,
            totalAmount,
          },
        },
      });
    });

    revalidatePath(`/musteri/panel/hizmetlerim/${service.id}`);
    revalidatePath(`/musteri/panel/hizmetlerim/${service.id}/yenile`);
    revalidatePath("/musteri/panel/hizmetlerim");
    revalidatePath("/musteri/panel/faturalar");
    revalidatePath("/musteri/panel/kredi");

    return {
      success: true,
      message: `Hizmet başarıyla ${input.months} ay yenilendi.`,
      newExpiryDate: newExpiryDate.toISOString(),
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "INSUFFICIENT_BALANCE") {
        return {
          success: false,
          error: "Yetersiz bakiye. Lütfen bakiye yükleyip tekrar deneyin.",
        };
      }
      if (error.message === "CUSTOMER_NOT_FOUND") {
        return { success: false, error: "Kullanıcı bulunamadı" };
      }
    }

    return { success: false, error: "Hizmet yenilenirken bir hata oluştu" };
  }
}

