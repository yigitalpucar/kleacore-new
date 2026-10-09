import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events/emit";
import { createLogger } from "@/lib/logger";
import { emailDomain, isDisposableEmailDomain } from "./disposable-domains";
import {
  evaluateRules,
  mergeRuleResults,
  scoreResults,
  scoreSignals,
  type FraudConfig,
  type FraudRuleResult,
} from "./rules";

const log = createLogger("fraud.evaluate");

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CheckoutFraudInput {
  customerId: string;
  ipAddress: string | null;
  ipCountry: string | null;
  ipCountrySource: "cf-header" | "db" | null;
  orders: Array<{ id: string; orderNumber: string; categorySlug: string }>;
  now?: Date;
}

export interface OrderFraudOutcome {
  orderId: string;
  score: number;
  status: "PASSED" | "REVIEW";
  paymentBlocked: boolean;
}

function billingNames(customer: { name: string; surname: string; companyName: string | null }) {
  return [`${customer.name} ${customer.surname}`.trim(), customer.companyName ?? ""].filter(Boolean);
}

function matchedLabels(results: FraudRuleResult[]) {
  return results.filter((result) => result.matched).map((result) => result.label);
}

/**
 * Scores the orders of one checkout and stores a FraudCheck per order, in the
 * checkout transaction. Orders at or over the review threshold get status
 * REVIEW (order.review_required → customer "inceleniyor" + staff alert);
 * over the block threshold the payment is refused until a reviewer approves.
 * Settings and the IP country are resolved by the caller before the
 * transaction (getFraudConfig, resolveIpCountry).
 */
export async function evaluateCheckoutOrders(
  tx: Prisma.TransactionClient,
  input: CheckoutFraudInput,
  config: FraudConfig
): Promise<OrderFraudOutcome[]> {
  if (!config.enabled || input.orders.length === 0) return [];
  const now = input.now ?? new Date();
  const orderIds = input.orders.map((order) => order.id);

  const customer = await tx.user.findUnique({
    where: { id: input.customerId },
    select: { email: true, name: true, surname: true, companyName: true, createdAt: true },
  });
  if (!customer) return [];

  const [previousOrders, sameIpOrders24h] = await Promise.all([
    tx.order.count({
      where: { customerId: input.customerId, id: { notIn: orderIds }, status: { not: "CANCELLED" } },
    }),
    input.ipAddress
      ? tx.fraudCheck.count({
          where: {
            ipAddress: input.ipAddress,
            orderId: { notIn: orderIds },
            createdAt: { gte: new Date(now.getTime() - DAY_MS) },
          },
        })
      : Promise.resolve(undefined),
  ]);

  const domain = emailDomain(customer.email);
  const outcomes: OrderFraudOutcome[] = [];

  for (const order of input.orders) {
    const scored = scoreSignals(
      {
        categorySlug: order.categorySlug,
        previousOrders,
        ipCountry: input.ipCountry,
        emailDomain: domain,
        disposableEmail: isDisposableEmailDomain(domain),
        sameIpOrders24h,
        billingNames: billingNames(customer),
        accountAgeMs: now.getTime() - customer.createdAt.getTime(),
      },
      config
    );
    const status = scored.review ? "REVIEW" : "PASSED";

    await tx.fraudCheck.create({
      data: {
        orderId: order.id,
        customerId: input.customerId,
        score: scored.score,
        threshold: config.reviewThreshold,
        status,
        paymentBlocked: scored.block,
        rules: scored.results as unknown as Prisma.InputJsonValue,
        ipAddress: input.ipAddress,
        ipCountry: input.ipCountry,
        ipCountrySource: input.ipCountrySource,
        stage: "checkout",
      },
    });

    if (scored.review) {
      await tx.orderActivity.create({
        data: {
          orderId: order.id,
          action: "FRAUD_REVIEW",
          description: `Risk puanı ${scored.score} (eşik ${config.reviewThreshold}): sipariş incelemeye alındı${scored.block ? ", ödeme engellendi" : ""}`,
          performedBy: "system",
          metadata: { score: scored.score, reasons: matchedLabels(scored.results) },
        },
      });
      await emitEvent(tx, "order.review_required", {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: input.customerId,
        score: scored.score,
        threshold: config.reviewThreshold,
        paymentBlocked: scored.block,
        stage: "checkout",
        reasons: matchedLabels(scored.results),
      });
    }

    outcomes.push({ orderId: order.id, score: scored.score, status, paymentBlocked: scored.block });
  }

  return outcomes;
}

/** Card data a gateway reported for the payment (any field may be unknown). */
export interface PaymentCardSignals {
  /** ISO country of the card's issuing bank (BIN). */
  binCountry?: string | null;
  holderName?: string | null;
}

export function hasCardSignals(card: PaymentCardSignals | null | undefined): card is PaymentCardSignals {
  return Boolean(card && (card.binCountry?.trim() || card.holderName?.trim()));
}

/**
 * Payment stage: re-scores an order's stored breakdown with the card rules
 * (BIN country, card holder vs billing name). A check already decided by
 * staff (APPROVED / REJECTED) is left alone. Crossing the threshold moves a
 * PASSED order to REVIEW; provisioning then waits (src/lib/provisioning/hold.ts).
 * Never stores the holder name itself, only whether it matched.
 */
export async function reevaluateOrderAtPayment(
  tx: Prisma.TransactionClient,
  orderId: string,
  card: PaymentCardSignals,
  config: FraudConfig
): Promise<{ changed: boolean; review: boolean }> {
  if (!config.enabled || !hasCardSignals(card)) return { changed: false, review: false };

  const check = await tx.fraudCheck.findUnique({
    where: { orderId },
    include: {
      order: {
        select: {
          orderNumber: true,
          customer: { select: { name: true, surname: true, companyName: true } },
        },
      },
    },
  });
  if (!check || check.status === "APPROVED" || check.status === "REJECTED") {
    return { changed: false, review: check?.status === "REVIEW" };
  }

  const cardRules = evaluateRules(
    {
      categorySlug: "",
      previousOrders: 1,
      cardCountry: card.binCountry,
      billingNames: billingNames(check.order.customer),
      cardHolderName: card.holderName,
    },
    config
  ).filter((result) => result.rule === "card_country_foreign" || result.rule === "name_mismatch");

  const scored = scoreResults(mergeRuleResults(check.rules, cardRules), config);
  const toReview = check.status === "PASSED" && scored.review;

  await tx.fraudCheck.update({
    where: { id: check.id },
    data: {
      score: scored.score,
      rules: scored.results as unknown as Prisma.InputJsonValue,
      cardCountry: card.binCountry?.trim().toUpperCase().slice(0, 2) || check.cardCountry,
      stage: "payment",
      ...(toReview ? { status: "REVIEW", threshold: config.reviewThreshold } : {}),
    },
  });

  if (toReview) {
    await tx.orderActivity.create({
      data: {
        orderId,
        action: "FRAUD_REVIEW",
        description: `Ödeme sonrası risk puanı ${scored.score} (eşik ${config.reviewThreshold}): kurulum inceleme bekliyor`,
        performedBy: "system",
        metadata: { score: scored.score, reasons: matchedLabels(scored.results) },
      },
    });
    await emitEvent(tx, "order.review_required", {
      orderId,
      orderNumber: check.order.orderNumber,
      customerId: check.customerId,
      score: scored.score,
      threshold: config.reviewThreshold,
      paymentBlocked: false,
      stage: "payment",
      reasons: matchedLabels(scored.results),
    });
  }

  return { changed: true, review: toReview || check.status === "REVIEW" };
}

export const PAYMENT_BLOCKED_MESSAGE =
  "Siparişiniz güvenlik incelemesinde, onaylandığında ödeme yapabilirsiniz. İnceleme tamamlanınca e-posta ile bilgilendirileceksiniz.";
export const ORDER_REJECTED_MESSAGE = "Bu sipariş inceleme sonucunda onaylanmadı; ödeme alınamaz.";

/**
 * Whether the invoices may be paid now: refused while an order of theirs is in
 * review with the payment blocked, or was rejected. Null = payable.
 */
export async function getPaymentBlock(
  invoiceIds: string[],
  client: Pick<typeof db, "fraudCheck"> = db
): Promise<string | null> {
  if (invoiceIds.length === 0) return null;
  try {
    const checks = await client.fraudCheck.findMany({
      where: {
        order: { invoice: { id: { in: invoiceIds } } },
        OR: [{ status: "REVIEW", paymentBlocked: true }, { status: "REJECTED" }],
      },
      select: { status: true },
    });
    if (checks.some((check) => check.status === "REJECTED")) return ORDER_REJECTED_MESSAGE;
    return checks.length > 0 ? PAYMENT_BLOCKED_MESSAGE : null;
  } catch (error) {
    // A failed lookup must not stop payments; the hold still protects provisioning.
    log.error("payment block lookup failed", { error });
    return null;
  }
}

/**
 * Payment-stage check at the moment card data is known on our side (Kuveyt
 * Türk card form: holder name), before the bank is called. Best effort: an
 * order moved to REVIEW still gets paid, its provisioning waits.
 */
export async function recordPaymentCardSignals(invoiceIds: string[], card: PaymentCardSignals) {
  if (invoiceIds.length === 0 || !hasCardSignals(card)) return;
  try {
    const { getFraudConfig } = await import("./settings");
    const config = await getFraudConfig();
    if (!config.enabled) return;
    const orders = await db.order.findMany({
      where: { invoice: { id: { in: invoiceIds } }, fraudCheck: { isNot: null } },
      select: { id: true },
    });
    for (const order of orders) {
      await db.$transaction((tx) => reevaluateOrderAtPayment(tx, order.id, card, config));
    }
  } catch (error) {
    log.error("payment card signals could not be recorded", { error });
  }
}
