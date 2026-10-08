import type {
  BillingPeriod,
  PlanChangeType,
  Prisma,
  Product,
  PricingTier,
  Service,
} from "@prisma/client";
import { db } from "@/lib/db";
import { changeRemoteServicePlan } from "@/lib/integrations/provisioning-provider";
import { calculateTax, getTaxRate } from "@/lib/billing/tax";
import { periodTotal, priceBasisForCategory } from "@/lib/billing/period-price";
import { billingMonths } from "@/lib/payments/renewal-fulfillment";
import {
  generateInvoiceNumber,
  generateOrderNumber,
} from "@/lib/utils/number-generators";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

type ProductWithPricing = Pick<Product, "basePrice"> & {
  pricingTiers: Array<
    Pick<PricingTier, "period" | "price" | "discountedPrice" | "isActive">
  >;
};

type ServiceForProration = Pick<
  Service,
  "amount" | "billingPeriod" | "nextDueDate" | "expiresAt"
>;

export interface ProratedPlanChangeResult {
  proratedAmount: number;
  remainingDays: number;
  totalDays: number;
  priceDiff: number;
  currentPrice: number;
  newPrice: number;
}

function resolveProductPrice(
  product: Pick<Product, "basePrice"> & {
    pricingTiers: Array<
      Pick<PricingTier, "period" | "price" | "discountedPrice" | "isActive">
    >;
  },
  billingPeriod: BillingPeriod,
  categorySlug?: string | null
): number {
  const tier = product.pricingTiers.find(
    (pricing) => pricing.period === billingPeriod && pricing.isActive
  );
  // Service amounts are the pre-tax charge for one whole billing period, so a
  // yearly hosting/server tier (stored as a monthly equivalent) becomes 12 ×.
  return periodTotal(
    Number(tier?.discountedPrice ?? tier?.price ?? product.basePrice),
    billingPeriod,
    priceBasisForCategory(categorySlug)
  );
}

function daysBetween(start: Date, end: Date): number {
  const startDay = Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate()
  );
  const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.max(0, Math.round((endDay - startDay) / MS_PER_DAY));
}

export function calculateProratedPlanChange(
  service: ServiceForProration,
  targetProduct: ProductWithPricing,
  billingPeriod: BillingPeriod = service.billingPeriod,
  categorySlug?: string | null
): ProratedPlanChangeResult {
  const currentPrice = Number(service.amount);
  const newPrice = resolveProductPrice(targetProduct, billingPeriod, categorySlug);
  const priceDiff = Number((newPrice - currentPrice).toFixed(2));

  const now = new Date();
  const periodEnd = service.nextDueDate ?? service.expiresAt ?? now;
  const remainingDays = daysBetween(now, periodEnd);

  const totalDays = billingMonths[billingPeriod] * 30;
  const proratedAmount =
    totalDays > 0
      ? Number(((remainingDays / totalDays) * priceDiff).toFixed(2))
      : priceDiff;

  return {
    proratedAmount,
    remainingDays,
    totalDays,
    priceDiff,
    currentPrice,
    newPrice,
  };
}

export function determinePlanChangeType(
  fromProduct: Pick<Product, "displayOrder" | "basePrice">,
  toProduct: Pick<Product, "displayOrder" | "basePrice">
): PlanChangeType {
  if (toProduct.displayOrder > fromProduct.displayOrder) {
    return "UPGRADE";
  }
  if (toProduct.displayOrder < fromProduct.displayOrder) {
    return "DOWNGRADE";
  }

  return toProduct.basePrice >= fromProduct.basePrice ? "UPGRADE" : "DOWNGRADE";
}

function parsePlanChangeConfiguration(configuration: unknown): {
  type: "plan_change";
  planChangeId: string;
  serviceId: string;
} | null {
  if (!configuration || typeof configuration !== "object" || Array.isArray(configuration)) {
    return null;
  }

  const record = configuration as Record<string, unknown>;
  if (record.type !== "plan_change") {
    return null;
  }

  if (typeof record.planChangeId !== "string" || typeof record.serviceId !== "string") {
    return null;
  }

  return {
    type: "plan_change",
    planChangeId: record.planChangeId,
    serviceId: record.serviceId,
  };
}

export function isPlanChangeOrder(
  order: {
    serviceId: string | null;
    items: Array<{ configuration: unknown }>;
  } | null
) {
  if (!order?.serviceId) {
    return false;
  }

  return parsePlanChangeConfiguration(order.items.at(0)?.configuration) !== null;
}

interface RequestPlanChangeInput {
  serviceId: string;
  targetProductSku: string;
  customerId: string;
  paymentMethod?: "CREDIT_CARD" | "BANK_TRANSFER";
}

export async function requestPlanChange(input: RequestPlanChangeInput) {
  const service = await db.service.findUnique({
    where: { id: input.serviceId },
    include: {
      product: {
        include: {
          category: true,
          pricingTiers: { where: { isActive: true } },
        },
      },
    },
  });

  if (!service) {
    throw new Error("SERVICE_NOT_FOUND");
  }

  if (service.customerId !== input.customerId) {
    throw new Error("SERVICE_ACCESS_DENIED");
  }

  if (service.status !== "ACTIVE") {
    throw new Error("SERVICE_NOT_ACTIVE");
  }

  const targetProduct = await db.product.findFirst({
    where: {
      sku: input.targetProductSku,
      status: "ACTIVE",
      isVisible: true,
      categoryId: service.product.categoryId,
    },
    include: {
      pricingTiers: { where: { isActive: true } },
    },
  });

  if (!targetProduct) {
    throw new Error("TARGET_PRODUCT_NOT_FOUND");
  }

  if (targetProduct.id === service.productId) {
    throw new Error("SAME_PRODUCT");
  }

  const existingPending = await db.servicePlanChange.findFirst({
    where: {
      serviceId: service.id,
      status: { in: ["PENDING", "PAYMENT_PENDING"] },
    },
  });

  if (existingPending) {
    throw new Error("PLAN_CHANGE_ALREADY_PENDING");
  }

  const changeType = determinePlanChangeType(service.product, targetProduct);
  const proration = calculateProratedPlanChange(
    service,
    targetProduct,
    service.billingPeriod,
    service.product.category.slug
  );
  const chargeAmount = changeType === "UPGRADE" ? Math.max(0, proration.proratedAmount) : 0;

  const now = new Date();
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + 7);

  const taxRate = await getTaxRate();
  const taxed = calculateTax(chargeAmount, taxRate);
  const totalAmount = taxed.totalAmount;

  const result = await db.$transaction(async (tx) => {
    const initialStatus = changeType === "DOWNGRADE" ? "PENDING" : "PAYMENT_PENDING";

    const planChange = await tx.servicePlanChange.create({
      data: {
        serviceId: service.id,
        customerId: input.customerId,
        fromProductId: service.productId,
        toProductId: targetProduct.id,
        type: changeType,
        status: initialStatus,
        proratedAmount: proration.proratedAmount,
        notes:
          changeType === "DOWNGRADE"
            ? "Düşürme talebi yönetici onayı bekliyor"
            : chargeAmount > 0
              ? "Yükseltme ödemesi bekleniyor"
              : "Yükseltme ödeme gerektirmiyor",
      },
    });

    if (changeType === "DOWNGRADE") {
      return {
        planChangeId: planChange.id,
        type: changeType,
        requiresPayment: false,
        requiresApproval: true,
        totalAmount: 0,
      };
    }

    const order = await tx.order.create({
      data: {
        orderNumber: await generateOrderNumber(),
        customerId: input.customerId,
        productId: targetProduct.id,
        serviceId: service.id,
        domain: service.domain,
        billingPeriod: service.billingPeriod,
        quantity: 1,
        basePrice: chargeAmount,
        discountAmount: 0,
        setupFee: 0,
        taxRate: taxed.taxRate,
        taxAmount: taxed.taxAmount,
        totalAmount,
        status: "PENDING",
        customerNotes: `Paket yükseltme: ${service.product.name} → ${targetProduct.name}`,
        items: {
          create: {
            productName: `${targetProduct.name} Yükseltme`,
            productSku: targetProduct.sku,
            quantity: 1,
            unitPrice: totalAmount,
            discountAmount: 0,
            totalPrice: totalAmount,
            configuration: {
              type: "plan_change",
              planChangeId: planChange.id,
              serviceId: service.id,
              fromProductId: service.productId,
              toProductId: targetProduct.id,
              changeType,
            },
          },
        },
      },
    });

    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber: await generateInvoiceNumber(),
        customerId: input.customerId,
        orderId: order.id,
        subtotal: chargeAmount,
        taxRate: taxed.taxRate,
        taxAmount: taxed.taxAmount,
        totalAmount,
        status: "PENDING",
        dueDate,
        notes: `Paket yükseltme: ${service.product.name} → ${targetProduct.name}`,
        items: {
          create: {
            description: `${service.product.name} → ${targetProduct.name} (orantılı fark)`,
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
        customerId: input.customerId,
        amount: totalAmount,
        method: input.paymentMethod ?? "CREDIT_CARD",
        status: "PENDING",
        notes: "Paket yükseltme ödemesi bekleniyor",
      },
    });

    await tx.servicePlanChange.update({
      where: { id: planChange.id },
      data: {
        orderId: order.id,
        invoiceId: invoice.id,
      },
    });

    await tx.orderActivity.create({
      data: {
        orderId: order.id,
        action: "UPGRADE",
        description: `Paket yükseltme talebi: ${service.product.name} → ${targetProduct.name}`,
        performedBy: input.customerId,
        metadata: {
          planChangeId: planChange.id,
          serviceId: service.id,
          fromProduct: service.product.name,
          toProduct: targetProduct.name,
          priceDiff: proration.priceDiff,
          proratedAmount: proration.proratedAmount,
        },
      },
    });

    return {
      planChangeId: planChange.id,
      type: changeType,
      orderId: order.id,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      requiresPayment: totalAmount > 0,
      requiresApproval: false,
      totalAmount,
    };
  });

  return result;
}

export async function applyPlanChange(
  tx: Prisma.TransactionClient,
  planChangeId: string,
  performedBy: string
) {
  const planChange = await tx.servicePlanChange.findUnique({
    where: { id: planChangeId },
    include: {
      service: {
        include: {
          product: { include: { category: true } },
          customer: {
            select: { id: true, name: true, surname: true, email: true },
          },
        },
      },
      fromProduct: true,
      toProduct: {
        include: {
          pricingTiers: { where: { isActive: true } },
        },
      },
      order: true,
    },
  });

  if (!planChange) {
    throw new Error("PLAN_CHANGE_NOT_FOUND");
  }

  if (planChange.status === "COMPLETED") {
    return { applied: false, planChangeId: planChange.id };
  }

  if (planChange.status === "CANCELLED") {
    throw new Error("PLAN_CHANGE_CANCELLED");
  }

  if (planChange.type === "UPGRADE" && planChange.status === "PAYMENT_PENDING") {
    throw new Error("PLAN_CHANGE_PAYMENT_PENDING");
  }

  const newAmount = resolveProductPrice(
    planChange.toProduct,
    planChange.service.billingPeriod,
    planChange.service.product.category.slug
  );

  const now = new Date();

  await tx.service.update({
    where: { id: planChange.serviceId },
    data: {
      productId: planChange.toProductId,
      amount: newAmount,
    },
  });

  await tx.servicePlanChange.update({
    where: { id: planChange.id },
    data: {
      status: "COMPLETED",
      completedAt: now,
    },
  });

  const updatedService = {
    ...planChange.service,
    productId: planChange.toProductId,
    product: planChange.toProduct,
    amount: newAmount,
  };

  const remoteResult = await changeRemoteServicePlan(
    updatedService,
    planChange.toProduct.sku
  );

  if (planChange.orderId) {
    const action = planChange.type === "UPGRADE" ? "UPGRADED" : "DOWNGRADED";
    const description =
      planChange.type === "UPGRADE"
        ? `Paket yükseltildi: ${planChange.fromProduct.name} → ${planChange.toProduct.name}`
        : `Paket düşürüldü: ${planChange.fromProduct.name} → ${planChange.toProduct.name}`;

    await tx.orderActivity.create({
      data: {
        orderId: planChange.orderId,
        action,
        description,
        performedBy,
        metadata: {
          planChangeId: planChange.id,
          serviceId: planChange.serviceId,
          fromProduct: planChange.fromProduct.name,
          toProduct: planChange.toProduct.name,
          priceDiff: planChange.proratedAmount,
          remoteApplied: remoteResult.ok,
          remoteProvider: remoteResult.provider,
          remoteError: remoteResult.ok ? undefined : remoteResult.error,
        },
      },
    });
  }

  return {
    applied: true,
    planChangeId: planChange.id,
    serviceId: planChange.serviceId,
    changeType: planChange.type,
    remoteResult,
  };
}

export async function applyPlanChangeFromOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
  performedBy: string
): Promise<{
  applied: boolean;
  planChangeId?: string;
  serviceId?: string;
  changeType?: PlanChangeType;
}> {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) {
    return { applied: false };
  }

  const configuration = parsePlanChangeConfiguration(order.items.at(0)?.configuration);
  if (!configuration) {
    return { applied: false };
  }

  const planChange = await tx.servicePlanChange.findUnique({
    where: { id: configuration.planChangeId },
  });

  if (!planChange || planChange.status === "COMPLETED") {
    return { applied: false };
  }

  if (planChange.type === "UPGRADE" && planChange.status === "PAYMENT_PENDING") {
    await tx.servicePlanChange.update({
      where: { id: planChange.id },
      data: { status: "PENDING" },
    });
  }

  return applyPlanChange(tx, configuration.planChangeId, performedBy);
}

export async function approvePlanChangeDowngrade(planChangeId: string, performedBy: string) {
  const planChange = await db.servicePlanChange.findUnique({
    where: { id: planChangeId },
  });

  if (!planChange) {
    throw new Error("PLAN_CHANGE_NOT_FOUND");
  }

  if (planChange.type !== "DOWNGRADE") {
    throw new Error("NOT_A_DOWNGRADE");
  }

  if (planChange.status !== "PENDING") {
    throw new Error("PLAN_CHANGE_NOT_PENDING");
  }

  return db.$transaction(async (tx) => {
    return applyPlanChange(tx, planChangeId, performedBy);
  });
}

export async function getPlanChangeOptionsForService(serviceId: string, customerId: string) {
  const service = await db.service.findUnique({
    where: { id: serviceId },
    include: {
      product: {
        include: {
          category: true,
          pricingTiers: { where: { isActive: true } },
        },
      },
    },
  });

  if (!service || service.customerId !== customerId) {
    return null;
  }

  const products = await db.product.findMany({
    where: {
      categoryId: service.product.categoryId,
      status: "ACTIVE",
      isVisible: true,
      id: { not: service.productId },
    },
    include: {
      pricingTiers: { where: { isActive: true } },
    },
    orderBy: { displayOrder: "asc" },
  });

  const upgrades = products
    .filter(
      (product) =>
        product.displayOrder > service.product.displayOrder ||
        (product.displayOrder === service.product.displayOrder &&
          product.basePrice > service.product.basePrice)
    )
    .map((product) => ({
      product,
      proration: calculateProratedPlanChange(
        service,
        product,
        service.billingPeriod,
        service.product.category.slug
      ),
      type: "UPGRADE" as const,
    }));

  const downgrades = products
    .filter(
      (product) =>
        product.displayOrder < service.product.displayOrder ||
        (product.displayOrder === service.product.displayOrder &&
          product.basePrice < service.product.basePrice)
    )
    .map((product) => ({
      product,
      proration: calculateProratedPlanChange(
        service,
        product,
        service.billingPeriod,
        service.product.category.slug
      ),
      type: "DOWNGRADE" as const,
    }));

  return {
    service,
    upgrades,
    downgrades,
  };
}