import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events/emit";
import { createLogger } from "@/lib/logger";
import { getKycConfig, type KycConfig } from "@/lib/kyc/settings";
import { prepareOrderProvisioning, type PreparedProvisioning } from "./internal";

const log = createLogger("provisioning.hold");

/**
 * Provisioning holds (Faz 4, docs/fraud-kyc.md). A paid order whose
 * provisioning must wait is parked as PROCESSING with `provisioningHeldAt`
 * set, instead of creating its service / ProvisioningJob:
 *  - FRAUD_REVIEW: its FraudCheck is REVIEW (or REJECTED);
 *  - KYC: its category needs identity verification and the customer's
 *    kycStatus is not APPROVED.
 * When the last reason goes away (review approved, KYC approved) the order is
 * released through `prepareOrderProvisioning`, i.e. the same post-commit
 * provisioning.run job path a normal payment uses.
 */

export const HOLD_REASONS = ["FRAUD_REVIEW", "KYC"] as const;
export type HoldReason = (typeof HOLD_REASONS)[number];

export const HOLD_REASON_LABELS: Record<HoldReason, string> = {
  FRAUD_REVIEW: "İnceleme bekliyor",
  KYC: "Kimlik doğrulaması bekliyor",
};

export interface HoldState {
  fraudStatus: "PASSED" | "REVIEW" | "APPROVED" | "REJECTED" | null;
  categorySlug: string;
  kycStatus: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
}

/** Pure: the reasons an order's provisioning must wait. */
export function holdReasonsFor(state: HoldState, kyc: Pick<KycConfig, "requiredCategories">): HoldReason[] {
  const reasons: HoldReason[] = [];
  if (state.fraudStatus === "REVIEW" || state.fraudStatus === "REJECTED") reasons.push("FRAUD_REVIEW");
  if (kyc.requiredCategories.includes(state.categorySlug.toLowerCase()) && state.kycStatus !== "APPROVED") {
    reasons.push("KYC");
  }
  return reasons;
}

type Client = Prisma.TransactionClient;

async function loadHoldState(client: Client, orderId: string) {
  return client.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      customerId: true,
      serviceId: true,
      status: true,
      provisioningHeldAt: true,
      provisioningHoldReasons: true,
      fraudCheck: { select: { status: true } },
      product: { select: { name: true, category: { select: { slug: true } } } },
      customer: { select: { kycStatus: true } },
    },
  });
}

type LoadedOrder = NonNullable<Awaited<ReturnType<typeof loadHoldState>>>;

function stateOf(order: LoadedOrder): HoldState {
  return {
    fraudStatus: order.fraudCheck?.status ?? null,
    categorySlug: order.product.category.slug,
    kycStatus: order.customer.kycStatus,
  };
}

/**
 * Inside the payment transaction, before the order's service is created:
 * parks the order when it must wait and returns the reasons (empty = go on).
 * Emits kyc.required so the customer is asked for documents.
 */
export async function holdOrderProvisioningIfNeeded(
  tx: Client,
  orderId: string,
  context: { performedBy: string; invoiceId?: string },
  kycConfig?: KycConfig
): Promise<HoldReason[]> {
  const order = await loadHoldState(tx, orderId);
  if (!order || order.serviceId) return [];

  const reasons = holdReasonsFor(stateOf(order), kycConfig ?? (await getKycConfig()));
  if (reasons.length === 0) return [];

  const now = new Date();
  await tx.order.update({
    where: { id: orderId },
    data: {
      status: "PROCESSING",
      processingStartedAt: now,
      completedAt: null,
      provisioningHeldAt: now,
      provisioningHoldReasons: reasons,
    },
  });
  await tx.orderActivity.create({
    data: {
      orderId,
      action: "PROVISIONING_HELD",
      description: `Ödeme alındı; kurulum bekletiliyor (${reasons.map((reason) => HOLD_REASON_LABELS[reason]).join(", ")})`,
      performedBy: context.performedBy,
      metadata: { reasons, invoiceId: context.invoiceId },
    },
  });

  if (reasons.includes("KYC") && order.customer.kycStatus !== "PENDING") {
    await emitEvent(tx, "kyc.required", {
      userId: order.customerId,
      orderId,
      orderNumber: order.orderNumber,
      productName: order.product.name,
    });
  }
  return reasons;
}

export type ReleaseResult =
  | { released: true; provisioned: PreparedProvisioning }
  | { released: false; reasons: HoldReason[]; notHeld?: boolean };

/**
 * Re-checks a held order and, when nothing holds it any more, clears the hold
 * (exactly once: conditional update under the row lock), completes the order
 * and runs the normal provisioning preparation, which queues the
 * provisioning.run job with the commit. Still-held orders get their reason
 * list refreshed.
 */
export async function releaseHeldOrder(
  orderId: string,
  actorId: string,
  options: { client?: typeof db; kycConfig?: KycConfig } = {}
): Promise<ReleaseResult> {
  const kycConfig = options.kycConfig ?? (await getKycConfig());
  return (options.client ?? db).$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`;
    const order = await loadHoldState(tx, orderId);
    if (!order || !order.provisioningHeldAt) return { released: false, reasons: [], notHeld: true };

    const reasons = holdReasonsFor(stateOf(order), kycConfig);
    if (reasons.length > 0) {
      if (reasons.join() !== order.provisioningHoldReasons.join()) {
        await tx.order.update({ where: { id: orderId }, data: { provisioningHoldReasons: reasons } });
      }
      return { released: false, reasons };
    }

    const now = new Date();
    const claimed = await tx.order.updateMany({
      where: { id: orderId, provisioningHeldAt: { not: null } },
      data: {
        provisioningHeldAt: null,
        provisioningHoldReasons: [],
        status: "COMPLETED",
        completedAt: now,
      },
    });
    if (claimed.count === 0) return { released: false, reasons: [], notHeld: true };

    const provisioned = await prepareOrderProvisioning(tx, orderId);
    await tx.orderActivity.create({
      data: {
        orderId,
        action: "PROVISIONING_RELEASED",
        description: "İnceleme / kimlik doğrulaması tamamlandı; kurulum başlatıldı",
        performedBy: actorId,
        metadata: provisioned,
      },
    });
    return { released: true, provisioned };
  });
}

/** After a KYC approval: releases every held order of the customer that is now free. */
export async function releaseHeldOrdersForCustomer(customerId: string, actorId: string) {
  const held = await db.order.findMany({
    where: { customerId, provisioningHeldAt: { not: null } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  const kycConfig = await getKycConfig();
  let released = 0;
  for (const order of held) {
    try {
      const result = await releaseHeldOrder(order.id, actorId, { kycConfig });
      if (result.released) released += 1;
    } catch (error) {
      log.error("could not release held order", { orderId: order.id, error });
    }
  }
  return { held: held.length, released };
}

/** Clears a hold without provisioning (order rejected / cancelled). */
export async function clearProvisioningHold(tx: Client, orderId: string) {
  await tx.order.updateMany({
    where: { id: orderId, provisioningHeldAt: { not: null } },
    data: { provisioningHeldAt: null, provisioningHoldReasons: [] },
  });
}
