/**
 * Server-side cart pricing shared by checkoutCart (which charges it) and
 * previewCartQuote (which shows it on the cart page before payment). Moved
 * verbatim from src/lib/actions/customer/checkout.ts so both read the same
 * catalogue rules; not a "use server" module — these helpers must not become
 * callable actions.
 */
import type { BillingPeriod, Prisma } from "@prisma/client";
import { checkDomainName } from "@/lib/validations/domain-name";
import { cartDomainItemName } from "@/lib/checkout/validate-cart";
import {
  addonPeriodTotal,
  periodTotal,
  priceBasisForCategory,
} from "@/lib/billing/period-price";
import {
  calculateConfigurationPrice,
  validateConfigurationSelections,
} from "@/lib/products/configurator";
import {
  add,
  compare,
  isPositive,
  min,
  mul,
  percent,
  roundHalfUp,
  sum,
  toNumber,
} from "@/lib/money";

export interface CheckoutAddonInput {
  sku: string;
}

export interface CheckoutItemInput {
  id: string;
  type: "domain" | "hosting" | "server" | "ssl" | "datacenter";
  quantity: number;
  metadata?: {
    domain?: string;
    planCode?: string;
    billingPeriod?: "monthly" | "yearly";
    category?: string;
    location?: string;
    subType?: string;
    domainChoice?: {
      type: "new" | "existing" | "later";
      domain?: string;
    };
    addons?: CheckoutAddonInput[];
    configuration?: Record<string, string | number>;
  };
}

export function normalizeBillingPeriod(value: string | undefined): BillingPeriod {
  return value === "yearly" ? "yearly" : "monthly";
}

/** Hosting domain choice with its domain normalised like the domain items. */
export function normalizeDomainChoice(choice: NonNullable<CheckoutItemInput["metadata"]>["domainChoice"]) {
  if (!choice?.domain) {
    return choice;
  }
  const check = checkDomainName(choice.domain);
  return check.ok ? { ...choice, domain: check.domain } : choice;
}

export function getDomainName(item: CheckoutItemInput) {
  const raw = cartDomainItemName(item);
  const check = checkDomainName(raw);
  return check.ok ? check.domain : raw.toLowerCase();
}

export async function getDomainProduct(domain: string, tx: Prisma.TransactionClient) {
  const tlds = await tx.domainTld.findMany({
    where: { isActive: true },
    orderBy: { ext: "desc" },
  });

  const tld = tlds
    .sort((a, b) => b.ext.length - a.ext.length)
    .find((record) => domain.endsWith(record.ext));

  if (!tld) {
    throw new Error(`DOMAIN_TLD_NOT_FOUND:${domain}`);
  }

  const sku = tld.ext === ".com.tr" ? "DOM-TR" : tld.ext === ".com" ? "DOM-COM" : null;
  const product =
    (sku
      ? await tx.product.findUnique({
          where: { sku },
          include: { category: true, pricingTiers: true },
        })
      : null) ??
    (await tx.product.findFirst({
      where: {
        status: "ACTIVE",
        category: { slug: "domain" },
      },
      include: { category: true, pricingTiers: true },
      orderBy: { displayOrder: "asc" },
    }));

  if (!product) {
    throw new Error("DOMAIN_PRODUCT_NOT_FOUND");
  }

  return {
    product,
    unitPrice: roundHalfUp(tld.registerPrice),
    renewPrice: toNumber(tld.renewPrice),
    tld: tld.ext,
  };
}

export async function getCatalogProduct(item: CheckoutItemInput, tx: Prisma.TransactionClient) {
  const sku = item.metadata?.planCode?.trim();
  if (!sku) {
    throw new Error(`PRODUCT_SKU_MISSING:${item.id}`);
  }

  const product = await tx.product.findUnique({
    where: { sku },
    include: { category: true, pricingTiers: true },
  });

  if (!product || product.status !== "ACTIVE" || !product.isVisible) {
    throw new Error(`PRODUCT_NOT_FOUND:${sku}`);
  }

  const billingPeriod = normalizeBillingPeriod(item.metadata?.billingPeriod);
  const tier = product.pricingTiers.find((pricing) => pricing.period === billingPeriod && pricing.isActive);
  // Yearly tiers of hosting/server products store the monthly equivalent, so
  // the yearly charge is 12 × that price; domain/SSL/e-mail tiers are already
  // period totals (see src/lib/billing/period-price.ts).
  const basePrice = periodTotal(
    tier?.discountedPrice ?? tier?.price ?? product.basePrice,
    billingPeriod,
    priceBasisForCategory(product.category.slug)
  );

  const addonSkus = Array.from(
    new Set((item.metadata?.addons ?? []).map((addon) => addon.sku.trim()).filter(Boolean))
  );
  const addons =
    addonSkus.length > 0
      ? await tx.productAddon.findMany({
          where: {
            sku: { in: addonSkus },
            isActive: true,
          },
        })
      : [];

  if (addons.length !== addonSkus.length) {
    throw new Error(`ADDON_NOT_FOUND:${sku}`);
  }

  const addonTotal = sum(addons.map((addon) => addonPeriodTotal(addon, billingPeriod)));

  const configSelections = item.metadata?.configuration ?? {};
  const configValidation = await validateConfigurationSelections(product.id, configSelections);
  if (!configValidation.valid) {
    throw new Error(`CONFIG_INVALID:${configValidation.errors[0] ?? "Geçersiz yapılandırma"}`);
  }

  const configPricing = calculateConfigurationPrice(
    configValidation.options,
    configSelections,
    billingPeriod
  );

  return {
    product,
    billingPeriod,
    unitPrice: roundHalfUp(add(basePrice, addonTotal, configPricing.total)),
    addons,
    configOptions: configPricing.lines,
    configSelections,
  };
}

export function jsonStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

export function promoAppliesToPreparedItem(
  promo: {
    applicableCategories: unknown;
    applicableProducts: unknown;
    applicablePeriods: unknown;
  },
  item: {
    productSku: string;
    categorySlug: string;
    billingPeriod: BillingPeriod;
  }
) {
  const categories = jsonStringArray(promo.applicableCategories);
  const products = jsonStringArray(promo.applicableProducts);
  const periods = jsonStringArray(promo.applicablePeriods);

  const categoryOk = categories.length === 0 || categories.includes(item.categorySlug);
  const productOk = products.length === 0 || products.includes(item.productSku);
  const periodOk = periods.length === 0 || periods.includes(item.billingPeriod);

  return categoryOk && productOk && periodOk;
}

export async function calculatePromotion(
  tx: Prisma.TransactionClient,
  promoCode: string | undefined,
  /** null for a guest cart quote: the per-customer rules are checked at checkout. */
  customerId: string | null,
  preparedItems: Array<{
    productSku: string;
    categorySlug: string;
    billingPeriod: BillingPeriod;
    quantity: number;
    unitPrice: Prisma.Decimal;
  }>,
  subtotal: Prisma.Decimal
) {
  const normalizedCode = promoCode?.trim().toUpperCase();
  if (!normalizedCode) return null;

  const promo = await tx.promotionCode.findUnique({
    where: { code: normalizedCode },
  });

  if (!promo || promo.status !== "ACTIVE") {
    throw new Error("PROMO_NOT_FOUND");
  }

  const now = new Date();
  if (promo.validFrom > now || promo.validUntil < now) {
    throw new Error("PROMO_EXPIRED");
  }

  if (promo.minOrderAmount && compare(subtotal, promo.minOrderAmount) < 0) {
    throw new Error("PROMO_MIN_ORDER");
  }

  if (promo.maxUses > 0 && promo.currentUses >= promo.maxUses) {
    throw new Error("PROMO_USAGE_LIMIT");
  }

  if (customerId) {
    const customerUsage = await tx.order.count({
      where: {
        customerId,
        promoCodeId: promo.id,
      },
    });

    if (promo.maxUsesPerCustomer > 0 && customerUsage >= promo.maxUsesPerCustomer) {
      throw new Error("PROMO_CUSTOMER_LIMIT");
    }

    if (promo.isFirstOrderOnly) {
      const previousOrders = await tx.order.count({ where: { customerId } });
      if (previousOrders > 0) {
        throw new Error("PROMO_FIRST_ORDER_ONLY");
      }
    }
  }

  const applicableTotal = roundHalfUp(
    sum(
      preparedItems
        .filter((item) => promoAppliesToPreparedItem(promo, item))
        .map((item) => mul(item.unitPrice, item.quantity))
    )
  );

  if (!isPositive(applicableTotal)) {
    throw new Error("PROMO_NOT_APPLICABLE");
  }

  const discount =
    promo.discountType === "PERCENTAGE"
      ? percent(applicableTotal, promo.discountValue)
      : roundHalfUp(min(promo.discountValue, applicableTotal));

  if (!isPositive(discount)) {
    throw new Error("PROMO_NOT_APPLICABLE");
  }

  return {
    id: promo.id,
    code: promo.code,
    maxUses: promo.maxUses,
    discountAmount: discount,
    applicableTotal,
    applicableCategories: promo.applicableCategories,
    applicableProducts: promo.applicableProducts,
    applicablePeriods: promo.applicablePeriods,
  };
}
