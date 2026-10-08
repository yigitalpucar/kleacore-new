import type { BillingPeriod } from "@prisma/client";
import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events/emit";
import {
  generateInvoiceNumber,
  generateOrderNumber,
} from "@/lib/utils/number-generators";
import type { CronJobResult } from "./types";
import { calculateTax, getTaxRate } from "@/lib/billing/tax";
import { netInvoiceLine, netOrderItemAmounts } from "@/lib/billing/invoice-lines";

const billingPeriodLabels: Record<BillingPeriod, string> = {
  monthly: "1 ay",
  quarterly: "3 ay",
  semiannual: "6 ay",
  yearly: "12 ay",
  biennial: "24 ay",
  triennial: "36 ay",
};

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
    // Decimal maths inside calculateTax (src/lib/money.ts); kuruş-exact numbers out.
    const taxed = calculateTax(service.amount, taxRate);
    const subtotal = taxed.subtotal;
    const periodLabel = billingPeriodLabels[service.billingPeriod] ?? service.billingPeriod;

    const invoice = await db.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber: await generateOrderNumber(),
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
              ...netOrderItemAmounts({ unitPrice: subtotal }),
              configuration: {
                serviceId: service.id,
                autoRenewal: true,
              },
            },
          },
        },
      });

      const created = await tx.invoice.create({
        data: {
          invoiceNumber: await generateInvoiceNumber(),
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
            create: netInvoiceLine({
              description: `${service.product.name} yenileme (${periodLabel})`,
              unitPrice: subtotal,
            }),
          },
        },
        select: { id: true, invoiceNumber: true, totalAmount: true, dueDate: true },
      });
      // "Fatura oluştu" via the outbox; same dedupe key as the hourly sweep.
      await emitEvent(tx, "invoice.created", {
        invoiceId: created.id,
        invoiceNumber: created.invoiceNumber,
        customerId: service.customerId,
        totalAmount: created.totalAmount,
        dueDate: created.dueDate,
        source: "renewal",
      });
      return created;
    });

    createdInvoiceIds.push(invoice.id);
  }

  return {
    processed: createdInvoiceIds.length,
    skipped,
    ids: createdInvoiceIds,
  };
}