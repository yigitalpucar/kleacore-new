import type { BillingPeriod } from "@prisma/client";
import { db } from "@/lib/db";
import {
  generateInvoiceNumber,
  generateOrderNumber,
} from "@/lib/utils/number-generators";
import type { CronJobResult } from "./types";
import { calculateTax, getTaxRate } from "@/lib/billing/tax";

const billingPeriodLabels: Record<BillingPeriod, string> = {
  monthly: "1 ay",
  quarterly: "3 ay",
  semiannual: "6 ay",
  yearly: "12 ay",
  biennial: "24 ay",
  triennial: "36 ay",
};

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

export async function generateRenewalInvoices(): Promise<CronJobResult> {
  const now = new Date();
  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + 7);

  const services = await db.service.findMany({
    where: {
      status: { in: ["ACTIVE", "SUSPENDED"] },
      OR: [
        { expiresAt: { gte: now, lte: windowEnd } },
        { nextDueDate: { gte: now, lte: windowEnd } },
      ],
    },
    include: {
      product: {
        select: { id: true, name: true, sku: true },
      },
    },
  });

  if (services.length === 0) {
    return { processed: 0, skipped: 0, ids: [] };
  }

  const createdInvoiceIds: string[] = [];
  let skipped = 0;
  const taxRate = await getTaxRate();

  for (const service of services) {
    const existingInvoice = await db.invoice.findFirst({
      where: {
        customerId: service.customerId,
        status: { in: ["PENDING", "OVERDUE", "DRAFT"] },
        order: { serviceId: service.id },
      },
      select: { id: true },
    });

    if (existingInvoice) {
      skipped += 1;
      continue;
    }

    const expiryDate = service.nextDueDate ?? service.expiresAt ?? windowEnd;
    const subtotal = roundMoney(Number(service.amount));
    const taxed = calculateTax(subtotal, taxRate);
    const periodLabel = billingPeriodLabels[service.billingPeriod] ?? service.billingPeriod;

    const invoice = await db.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          customerId: service.customerId,
          productId: service.productId,
          serviceId: service.id,
          domain: service.domain,
          billingPeriod: service.billingPeriod,
          quantity: 1,
          basePrice: subtotal,
          discountAmount: 0,
          setupFee: 0,
          taxRate: taxed.taxRate,
          taxAmount: taxed.taxAmount,
          totalAmount: taxed.totalAmount,
          status: "PENDING",
          customerNotes: "Otomatik yenileme faturası",
          items: {
            create: {
              productName: `${service.product.name} Yenileme`,
              productSku: service.product.sku,
              quantity: 1,
              unitPrice: taxed.totalAmount,
              discountAmount: 0,
              totalPrice: taxed.totalAmount,
              configuration: {
                serviceId: service.id,
                autoRenewal: true,
              },
            },
          },
        },
      });

      return tx.invoice.create({
        data: {
          invoiceNumber: generateInvoiceNumber(),
          customerId: service.customerId,
          orderId: order.id,
          subtotal,
          taxRate: taxed.taxRate,
          taxAmount: taxed.taxAmount,
          totalAmount: taxed.totalAmount,
          status: "PENDING",
          dueDate: expiryDate,
          notes: `Hizmet yenileme (${periodLabel})`,
          items: {
            create: {
              description: `${service.product.name} yenileme (${periodLabel})`,
              quantity: 1,
              unitPrice: taxed.totalAmount,
              totalPrice: taxed.totalAmount,
            },
          },
        },
        select: { id: true },
      });
    });

    createdInvoiceIds.push(invoice.id);
  }

  return {
    processed: createdInvoiceIds.length,
    skipped,
    ids: createdInvoiceIds,
  };
}