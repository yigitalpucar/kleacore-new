"use server";

import type { BillingPeriod, Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTaxRate } from "@/lib/billing/tax";
import { allocateCartLines } from "@/lib/billing/cart-pricing";
import { priceBasisForCategory } from "@/lib/billing/period-price";
import {
  calculatePromotion,
  getCatalogProduct,
  getDomainName,
  getDomainProduct,
  promoAppliesToPreparedItem,
  type CheckoutItemInput,
} from "@/lib/checkout/pricing";
import { getResellerDiscountForCustomer } from "@/lib/reseller";
import { checkRateLimit, normalizeRateLimitKey } from "@/lib/rate-limit";
import { getRequestMeta } from "@/lib/request-meta";
import { money, mul, roundHalfUp, sum, toNumber } from "@/lib/money";
import { formatTRY } from "@/lib/format/price";
import { promoErrorMessage, quoteLineErrorMessage } from "@/lib/checkout/quote-messages";

const MAX_QUOTE_ITEMS = 50;
const WINDOW_MS = 10 * 60 * 1000;

export interface CartQuotePeriodOption {
  period: "monthly" | "yearly";
  /** Pre-tax charge for one billing period (12-month total for yearly). */
  unitPrice: number;
}

export type CartQuoteLine =
  | {
      id: string;
      ok: true;
      unitPrice: number;
      period: "monthly" | "yearly";
      /** Other billing periods this line can switch to, with their charge. */
      periodOptions: CartQuotePeriodOption[];
      discount: number;
    }
  | { id: string; ok: false; error: string };

export interface CartQuote {
  lines: CartQuoteLine[];
  /** Pre-tax total of the priced lines, before discounts. */
  subtotal: number;
  promoDiscount: number;
  resellerDiscount: number;
  resellerPercent: number | null;
  taxRate: number;
  taxAmount: number;
  total: number;
  promo:
    | null
    | { code: string; ok: true; discount: number }
    | { code: string; ok: false; error: string };
}

export type CartQuoteResult =
  | { success: true; data: CartQuote }
  | { success: false; error: string; code?: "RATE_LIMITED" | "INVALID" };

async function rateLimited(scope: string, subject: string, limit: number) {
  const result = await checkRateLimit({
    key: `${scope}:${normalizeRateLimitKey(subject)}`,
    limit,
    windowMs: WINDOW_MS,
  });
  return !result.allowed;
}

/**
 * Server-priced cart quote for the cart page: the same catalogue prices,
 * promotion rules, reseller discount and per-line KDV that checkoutCart will
 * charge (src/lib/checkout/pricing.ts + src/lib/billing/cart-pricing.ts),
 * computed without writing anything. Also returns the price of each
 * hosting/server line in its other billing period so the cart can switch
 * periods without guessing.
 *
 * A guest gets the quote too; per-customer promo rules (first order only,
 * uses per customer) are then checked at checkout.
 */
export async function previewCartQuote(input: {
  items: CheckoutItemInput[];
  promoCode?: string;
}): Promise<CartQuoteResult> {
  if (!Array.isArray(input?.items) || input.items.length > MAX_QUOTE_ITEMS) {
    return { success: false, error: "Sepet okunamadı", code: "INVALID" };
  }

  const [session, requestMeta] = await Promise.all([auth(), getRequestMeta()]);
  const customerId = session?.user?.id ?? null;
  const subject = customerId ? `user:${customerId}` : `ip:${requestMeta.ip ?? "unknown"}`;
  const promoCode = input.promoCode?.trim().toUpperCase().slice(0, 64) || undefined;

  if (await rateLimited("cart-quote", subject, 240)) {
    return {
      success: false,
      error: "Çok fazla istek yapıldı. Lütfen biraz sonra tekrar deneyin.",
      code: "RATE_LIMITED",
    };
  }

  const taxRate = await getTaxRate();
  const lines: CartQuoteLine[] = [];
  const prepared: Array<{
    id: string;
    productSku: string;
    categorySlug: string;
    billingPeriod: BillingPeriod;
    quantity: number;
    unitPrice: Prisma.Decimal;
  }> = [];
  const tx = db as unknown as Prisma.TransactionClient;

  for (const item of input.items) {
    const quantity = Math.max(1, Math.min(99, Number(item.quantity) || 1));
    try {
      if (item.type === "domain") {
        const domainProduct = await getDomainProduct(getDomainName(item), tx);
        prepared.push({
          id: item.id,
          productSku: domainProduct.product.sku,
          categorySlug: domainProduct.product.category.slug,
          billingPeriod: "yearly",
          quantity,
          unitPrice: domainProduct.unitPrice,
        });
        lines.push({
          id: item.id,
          ok: true,
          unitPrice: toNumber(domainProduct.unitPrice),
          period: "yearly",
          periodOptions: [],
          discount: 0,
        });
        continue;
      }

      const catalogProduct = await getCatalogProduct(item, tx);
      const period = catalogProduct.billingPeriod === "yearly" ? "yearly" : "monthly";
      const periodOptions: CartQuotePeriodOption[] = [{ period, unitPrice: toNumber(catalogProduct.unitPrice) }];

      // Only monthly-equivalent products (hosting, servers) switch periods in
      // the cart; domain/SSL tiers are sold per their own period.
      if (priceBasisForCategory(catalogProduct.product.category.slug) === "monthly-equivalent") {
        const other = period === "yearly" ? "monthly" : "yearly";
        const hasTier = catalogProduct.product.pricingTiers.some(
          (tier) => tier.period === other && tier.isActive
        );
        if (hasTier) {
          try {
            const alternative = await getCatalogProduct(
              { ...item, metadata: { ...item.metadata, billingPeriod: other } },
              tx
            );
            periodOptions.push({ period: other, unitPrice: toNumber(alternative.unitPrice) });
          } catch {
            // The other period is simply not offered.
          }
        }
      }

      prepared.push({
        id: item.id,
        productSku: catalogProduct.product.sku,
        categorySlug: catalogProduct.product.category.slug,
        billingPeriod: catalogProduct.billingPeriod,
        quantity,
        unitPrice: catalogProduct.unitPrice,
      });
      lines.push({
        id: item.id,
        ok: true,
        unitPrice: toNumber(catalogProduct.unitPrice),
        period,
        periodOptions: periodOptions.sort((a, b) => (a.period === "monthly" ? -1 : b.period === "monthly" ? 1 : 0)),
        discount: 0,
      });
    } catch (error) {
      lines.push({ id: item.id, ok: false, error: quoteLineErrorMessage(error) });
    }
  }

  const subtotal = roundHalfUp(sum(prepared.map((line) => mul(line.unitPrice, line.quantity))));

  let promo: CartQuote["promo"] = null;
  let promotion: Awaited<ReturnType<typeof calculatePromotion>> = null;
  if (promoCode) {
    // Coupon guessing is limited separately from ordinary cart refreshes.
    if (await rateLimited("cart-quote-promo", subject, 30)) {
      promo = { code: promoCode, ok: false, error: "Çok fazla kupon denemesi yapıldı. Lütfen biraz sonra tekrar deneyin." };
    } else if (prepared.length === 0) {
      promo = { code: promoCode, ok: false, error: "Kupon uygulanacak ürün yok." };
    } else {
      try {
        promotion = await calculatePromotion(tx, promoCode, customerId, prepared, subtotal);
        promo = promotion
          ? { code: promotion.code, ok: true, discount: toNumber(promotion.discountAmount) }
          : null;
      } catch (error) {
        let minOrder: string | undefined;
        if (error instanceof Error && error.message === "PROMO_MIN_ORDER") {
          const record = await db.promotionCode.findUnique({
            where: { code: promoCode },
            select: { minOrderAmount: true },
          });
          minOrder = record?.minOrderAmount ? formatTRY(toNumber(record.minOrderAmount), { keepDecimals: true }) : undefined;
        }
        promo = { code: promoCode, ok: false, error: promoErrorMessage(error, { minOrder }) };
      }
    }
  }

  const reseller = customerId ? await getResellerDiscountForCustomer(customerId, db) : null;
  const allocated = allocateCartLines(
    prepared.map((line) => ({
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      promoApplies: Boolean(promotion && promoAppliesToPreparedItem(promotion, line)),
    })),
    { promotion, resellerPercent: reseller ? reseller.discountPercent : null, taxRate }
  );

  const discountById = new Map(prepared.map((line, index) => [line.id, toNumber(allocated[index].lineDiscount)]));
  for (const line of lines) {
    if (line.ok) line.discount = discountById.get(line.id) ?? 0;
  }

  const promoDiscount = sum(allocated.map((line) => line.promoLineDiscount));
  const resellerDiscount = sum(allocated.map((line) => line.resellerLineDiscount));
  const taxAmount = sum(allocated.map((line) => money(line.taxed.taxAmount)));
  const total = sum(allocated.map((line) => money(line.taxed.totalAmount)));

  return {
    success: true,
    data: {
      lines,
      subtotal: toNumber(subtotal),
      promoDiscount: toNumber(promoDiscount),
      resellerDiscount: toNumber(resellerDiscount),
      resellerPercent: reseller ? toNumber(reseller.discountPercent) : null,
      taxRate,
      taxAmount: toNumber(taxAmount),
      total: toNumber(total),
      promo,
    },
  };
}
