import type { KycStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { parseRuleResults } from "@/lib/fraud/rules";

/** Data for the review queue, the KYC pages and the customer notices (docs/fraud-kyc.md). */

export type ReviewTab = "review" | "kyc" | "history";

const orderSummary = {
  id: true,
  orderNumber: true,
  status: true,
  totalAmount: true,
  createdAt: true,
  provisioningHeldAt: true,
  provisioningHoldReasons: true,
  product: { select: { name: true, category: { select: { slug: true, name: true } } } },
  customer: { select: { id: true, name: true, surname: true, companyName: true, email: true, kycStatus: true, createdAt: true } },
  invoice: { select: { id: true, invoiceNumber: true, status: true } },
} as const;

export function customerDisplayName(customer: { name: string; surname: string; companyName: string | null; email: string }) {
  return customer.companyName || `${customer.name} ${customer.surname}`.trim() || customer.email;
}

export async function getReviewQueue(tab: ReviewTab) {
  if (tab === "kyc") {
    const orders = await db.order.findMany({
      where: { provisioningHeldAt: { not: null }, provisioningHoldReasons: { has: "KYC" } },
      orderBy: { provisioningHeldAt: "asc" },
      take: 200,
      select: { ...orderSummary, fraudCheck: { select: { score: true, threshold: true, status: true, rules: true, paymentBlocked: true, ipCountry: true } } },
    });
    return orders.map((order) => ({ order, check: order.fraudCheck }));
  }

  const checks = await db.fraudCheck.findMany({
    where: tab === "review" ? { status: "REVIEW" } : { status: { in: ["APPROVED", "REJECTED"] } },
    orderBy: tab === "review" ? { createdAt: "asc" } : { reviewedAt: "desc" },
    take: tab === "review" ? 200 : 100,
    select: {
      score: true,
      threshold: true,
      status: true,
      rules: true,
      paymentBlocked: true,
      ipCountry: true,
      reviewedAt: true,
      reviewNote: true,
      order: { select: orderSummary },
    },
  });
  return checks.map(({ order, ...check }) => ({ order, check }));
}

export async function getReviewCounts() {
  const [review, kyc, kycPending] = await Promise.all([
    db.fraudCheck.count({ where: { status: "REVIEW" } }),
    db.order.count({ where: { provisioningHeldAt: { not: null }, provisioningHoldReasons: { has: "KYC" } } }),
    db.user.count({ where: { kycStatus: "PENDING" } }),
  ]);
  return { review, kyc, kycPending };
}

/** Review card of the admin order page. */
export async function getOrderReview(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
      provisioningHeldAt: true,
      provisioningHoldReasons: true,
      customer: { select: { id: true, kycStatus: true } },
      invoice: {
        select: {
          status: true,
          payments: { where: { status: "COMPLETED" }, select: { method: true } },
        },
      },
      fraudCheck: true,
    },
  });
  if (!order) return null;
  return {
    ...order,
    rules: order.fraudCheck ? parseRuleResults(order.fraudCheck.rules) : [],
    paidByCard: order.invoice?.payments.some((payment) => payment.method === "CREDIT_CARD") ?? false,
  };
}

export async function getKycQueue(status: KycStatus) {
  return db.user.findMany({
    where: { kycStatus: status },
    orderBy: status === "PENDING" ? { kycSubmittedAt: "asc" } : { kycReviewedAt: "desc" },
    take: 200,
    select: {
      id: true,
      name: true,
      surname: true,
      companyName: true,
      email: true,
      customerType: true,
      kycStatus: true,
      kycSubmittedAt: true,
      kycReviewedAt: true,
      kycRejectionReason: true,
      _count: { select: { orders: { where: { provisioningHeldAt: { not: null } } } } },
    },
  });
}

export async function getKycCounts() {
  const rows = await db.user.groupBy({ by: ["kycStatus"], _count: { _all: true }, where: { kycStatus: { not: "NONE" } } });
  const counts: Record<KycStatus, number> = { NONE: 0, PENDING: 0, APPROVED: 0, REJECTED: 0 };
  for (const row of rows) counts[row.kycStatus] = row._count._all;
  return counts;
}

/** Admin KYC page of one customer. */
export async function getKycCustomer(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      surname: true,
      companyName: true,
      email: true,
      phone: true,
      customerType: true,
      taxNumber: true,
      taxOffice: true,
      address: true,
      city: true,
      country: true,
      createdAt: true,
      kycStatus: true,
      kycSubmittedAt: true,
      kycReviewedAt: true,
      kycReviewedBy: true,
      kycRejectionReason: true,
      kycDocuments: {
        orderBy: { uploadedAt: "desc" },
        select: { id: true, type: true, fileName: true, mimeType: true, sizeBytes: true, uploadedAt: true, deleteAfter: true, deletedAt: true },
      },
      consentRecords: {
        where: { documentType: "KYC_CONSENT" },
        orderBy: { acceptedAt: "desc" },
        take: 5,
        select: { id: true, documentVersion: true, acceptedAt: true, ipAddress: true, snapshotHash: true },
      },
      orders: {
        where: { provisioningHeldAt: { not: null } },
        orderBy: { createdAt: "asc" },
        select: { id: true, orderNumber: true, provisioningHoldReasons: true, product: { select: { name: true } } },
      },
    },
  });
}

/** Customer panel: verification status, current documents and waiting orders. */
export async function getCustomerKycView(userId: string) {
  const [user, waiting] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        customerType: true,
        kycStatus: true,
        kycSubmittedAt: true,
        kycReviewedAt: true,
        kycRejectionReason: true,
        kycDocuments: {
          where: { deletedAt: null },
          orderBy: { uploadedAt: "desc" },
          select: { id: true, type: true, fileName: true, uploadedAt: true, deleteAfter: true },
        },
      },
    }),
    getCustomerWaitingOrders(userId),
  ]);
  return user ? { ...user, waiting } : null;
}

/** Orders of a customer that wait for review / KYC (paid and held, or unpaid with the payment blocked). */
export async function getCustomerWaitingOrders(userId: string) {
  const orders = await db.order.findMany({
    where: {
      customerId: userId,
      status: { notIn: ["CANCELLED", "REFUNDED"] },
      OR: [{ provisioningHeldAt: { not: null } }, { fraudCheck: { status: "REVIEW" } }],
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      orderNumber: true,
      provisioningHeldAt: true,
      provisioningHoldReasons: true,
      product: { select: { name: true } },
      fraudCheck: { select: { status: true, paymentBlocked: true } },
      invoice: { select: { id: true, status: true } },
    },
  });
  return orders.map((order) => {
    const kyc = order.provisioningHoldReasons.includes("KYC");
    const review = order.fraudCheck?.status === "REVIEW";
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      productName: order.product.name,
      paid: order.invoice?.status === "PAID",
      invoiceId: order.invoice?.id ?? null,
      waitingForKyc: kyc,
      inReview: review,
      paymentBlocked: review && (order.fraudCheck?.paymentBlocked ?? false),
    };
  });
}
