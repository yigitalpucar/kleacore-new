"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  generateInvoiceNumber,
  generateOrderNumber,
} from "@/lib/utils/number-generators";
import {
  dispatchNotification,
  loadCustomerRecipient,
  sendOrderConfirmationEmail,
} from "@/lib/notifications/email";
import {
  applyResellerDiscount,
  getResellerDiscountForCustomer,
} from "@/lib/reseller";
import { getAppBaseUrl, getStripe } from "@/lib/stripe";
import { persistGatewayCheckout } from "@/lib/integrations/payment-gateways/persist";
import { getPaymentGatewayProvider } from "@/lib/integrations/payment-gateways";
import { loadCheckoutCustomer } from "@/lib/payments/orchestrator";
import { getPurchaseBlock } from "@/lib/auth/email-verification";
import {
  LEGAL_CONSENT_OUTDATED_MESSAGE,
  LEGAL_CONSENT_REQUIRED_MESSAGE,
  assertCheckoutConsents,
  getCheckoutLegalDocuments,
  getLegalBuyer,
  getLegalSeller,
  legalPaymentMethodLabel,
  recordCheckoutConsents,
  type AcceptedLegalDocument,
} from "@/lib/legal/documents";
import type { LegalOrderItem } from "@/lib/legal/render";
import { getRequestMeta } from "@/lib/request-meta";
import { revalidatePath } from "next/cache";
import type { BillingPeriod, Prisma } from "@prisma/client";
import { resolveCustomerPaymentMethod } from "@/lib/payments/payment-options";
import { paymentRecordMethod } from "@/lib/integrations/payment-gateways/methods-config";
import {
  balancePaymentErrorMessage,
  payInvoicesWithBalance,
} from "@/lib/payments/balance-payment";
import { claimPromotionUse } from "@/lib/billing/promo-usage";
import { calculateTax, getTaxRate } from "@/lib/billing/tax";
import { netInvoiceLine, netOrderItemAmounts } from "@/lib/billing/invoice-lines";
import {
  cartDomainItemName,
  validateCartItems,
  type CartValidationError,
} from "@/lib/checkout/validate-cart";
import { sslAllowsWildcard } from "@/lib/provisioning/internal";
import { checkDomainName } from "@/lib/validations/domain-name";
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
  div,
  isPositive,
  max,
  min,
  money,
  mul,
  percent,
  roundHalfUp,
  sub,
  sum,
  toKurus,
  toNumber,
} from "@/lib/money";

interface CheckoutAddonInput {
  sku: string;
}

interface CheckoutItemInput {
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

interface CheckoutInput {
  /** Method id from the picker ("kuveytturk", "bank_transfer", "balance", …) or legacy "CREDIT_CARD". */
  paymentMethod: string;
  items: CheckoutItemInput[];
  promoCode?: string;
  /** Ön bilgilendirme formu + mesafeli satış sözleşmesi versions the buyer accepted. */
  consents?: AcceptedLegalDocument[];
}

function normalizeBillingPeriod(value: string | undefined): BillingPeriod {
  return value === "yearly" ? "yearly" : "monthly";
}

/** Hosting domain choice with its domain normalised like the domain items. */
function normalizeDomainChoice(choice: NonNullable<CheckoutItemInput["metadata"]>["domainChoice"]) {
  if (!choice?.domain) {
    return choice;
  }
  const check = checkDomainName(choice.domain);
  return check.ok ? { ...choice, domain: check.domain } : choice;
}

function getDomainName(item: CheckoutItemInput) {
  const raw = cartDomainItemName(item);
  const check = checkDomainName(raw);
  return check.ok ? check.domain : raw.toLowerCase();
}

async function getDomainProduct(domain: string, tx: Prisma.TransactionClient) {
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

async function getCatalogProduct(item: CheckoutItemInput, tx: Prisma.TransactionClient) {
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

function jsonStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
}

function promoAppliesToPreparedItem(
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

async function calculatePromotion(
  tx: Prisma.TransactionClient,
  promoCode: string | undefined,
  customerId: string,
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

export async function checkoutCart(input: CheckoutInput) {
  const session = await auth();
  const customerId = session?.user?.id;

  if (!customerId) {
    return { success: false, error: "Ödeme için giriş yapmalısınız", code: "LOGIN_REQUIRED" as const };
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { success: false, error: "Sepetiniz boş" };
  }

  const purchaseBlock = await getPurchaseBlock(customerId);
  if (purchaseBlock) {
    return purchaseBlock;
  }

  // Bad carts (SSL without a domain, invalid domain names, hosting pointing at
  // a domain that isn't bought) are rejected here, before anything is
  // written or charged: a paid order must never fail provisioning on its data.
  const soldTlds = await db.domainTld.findMany({ where: { isActive: true }, select: { ext: true } });
  const cartErrors: CartValidationError[] = validateCartItems(input.items, {
    tlds: soldTlds.map((tld) => tld.ext),
  });
  if (cartErrors.length > 0) {
    return {
      success: false,
      error: cartErrors[0].message,
      code: "CART_INVALID" as const,
      errors: cartErrors,
    };
  }

  const method = await resolveCustomerPaymentMethod(input.paymentMethod);
  if (!method.id) {
    return { success: false, error: "Seçilen ödeme yöntemi şu anda kullanılamıyor" };
  }
  const methodId = method.id;
  const recordMethod = paymentRecordMethod(methodId);

  try {
    const legalDocuments = await getCheckoutLegalDocuments();
    assertCheckoutConsents(legalDocuments, input.consents);
    const [legalSeller, legalBuyer, requestMeta] = await Promise.all([
      getLegalSeller(),
      getLegalBuyer(customerId),
      getRequestMeta(),
    ]);
    if (!legalBuyer) {
      throw new Error("CUSTOMER_NOT_FOUND");
    }

    // Card payments go through the gateway the customer picked (the default
    // card gateway unless "Diğer kart ödeme seçenekleri" was used); Stripe
    // keeps its own session flow below.
    const cardProvider = method.cardGateway ? await getPaymentGatewayProvider(method.cardGateway) : null;
    if (cardProvider?.name === "disabled") {
      return {
        success: false,
        error: "Kartla ödeme şu anda kullanılamıyor. Lütfen başka bir ödeme yöntemi seçin.",
      };
    }
    const stripeClient = cardProvider?.name === "stripe" ? getStripe() : null;

    const result = await db.$transaction(async (tx) => {
      const customer = await tx.user.findUnique({
        where: { id: customerId },
        select: { balance: true },
      });

      if (!customer) {
        throw new Error("CUSTOMER_NOT_FOUND");
      }

      const resellerDiscount = await getResellerDiscountForCustomer(customerId, tx);

      const preparedItems = [];

      for (const item of input.items) {
        const quantity = Math.max(1, Math.min(99, Number(item.quantity) || 1));

        if (item.type === "domain") {
          const domain = getDomainName(item);
          const domainProduct = await getDomainProduct(domain, tx);

          preparedItems.push({
            item,
            productId: domainProduct.product.id,
            productName: `${domain} Domain Kaydı`,
            productSku: domainProduct.product.sku,
            categorySlug: domainProduct.product.category.slug,
            billingPeriod: "yearly" as BillingPeriod,
            quantity,
            unitPrice: domainProduct.unitPrice,
            configuration: {
              type: "domain",
              domain,
              tld: domainProduct.tld,
              renewPrice: domainProduct.renewPrice,
            },
          });

          continue;
        }

        const catalogProduct = await getCatalogProduct(item, tx);
        const domainChoice = normalizeDomainChoice(item.metadata?.domainChoice);
        let sslDomain: string | undefined;

        if (catalogProduct.product.category.slug === "ssl") {
          // Re-checked against the real product: only wildcard certificates
          // accept "*.example.com".
          const check = checkDomainName(item.metadata?.domain, {
            allowWildcard: sslAllowsWildcard(catalogProduct.product),
          });
          if (!check.ok) {
            throw new Error(`CART_INVALID:SSL sertifikası için geçerli bir alan adı girin`);
          }
          sslDomain = check.domain;
        }

        preparedItems.push({
          item,
          productId: catalogProduct.product.id,
          productName: catalogProduct.product.name,
          productSku: catalogProduct.product.sku,
          categorySlug: catalogProduct.product.category.slug,
          billingPeriod: catalogProduct.billingPeriod,
          quantity,
          unitPrice: catalogProduct.unitPrice,
          configuration: {
            type: item.type,
            domain: sslDomain,
            category: item.metadata?.category,
            location: item.metadata?.location,
            subType: item.metadata?.subType,
            domainChoice,
            addons: catalogProduct.addons.map((addon) => ({
              sku: addon.sku,
              name: addon.name,
              price: addonPeriodTotal(addon, catalogProduct.billingPeriod),
            })),
            configOptions: catalogProduct.configOptions,
            configSelections: catalogProduct.configSelections,
          },
        });
      }

      const subtotal = roundHalfUp(
        sum(preparedItems.map((item) => mul(item.unitPrice, item.quantity)))
      );

      if (!isPositive(subtotal)) {
        throw new Error("INVALID_TOTAL");
      }

      const promotion = await calculatePromotion(
        tx,
        input.promoCode,
        customerId,
        preparedItems,
        subtotal
      );
      const discountAmount = promotion?.discountAmount ?? money(0);
      const taxRate = await getTaxRate();

      const now = new Date();
      const dueDate = new Date(now);
      dueDate.setDate(dueDate.getDate() + 7);

      const orderIds: string[] = [];
      const invoiceIds: string[] = [];
      let checkoutTotalAmount = money(0);
      let checkoutTaxAmount = money(0);
      let checkoutLineTotal = money(0);
      let checkoutDiscount = money(0);
      const legalItems: LegalOrderItem[] = [];
      let totalResellerDiscount = money(0);
      let remainingDiscount = discountAmount;
      const applicableIndexes = promotion
        ? preparedItems
            .map((item, index) => (promoAppliesToPreparedItem(promotion, item) ? index : -1))
            .filter((index) => index >= 0)
        : [];
      const lastApplicableIndex = applicableIndexes[applicableIndexes.length - 1] ?? -1;

      for (const [index, item] of preparedItems.entries()) {
        const lineTotal = roundHalfUp(mul(item.unitPrice, item.quantity));
        // The promo discount is spread over its lines pro rata; the last line
        // takes the remainder so the line discounts add up to the promo exactly.
        const promoLineDiscount =
          promotion && promoAppliesToPreparedItem(promotion, item)
            ? index === lastApplicableIndex
              ? roundHalfUp(remainingDiscount)
              : roundHalfUp(div(mul(lineTotal, promotion.discountAmount), promotion.applicableTotal))
            : money(0);
        remainingDiscount = sub(remainingDiscount, promoLineDiscount);
        const afterPromoTotal = max(0, sub(lineTotal, promoLineDiscount));
        const resellerLineDiscount = resellerDiscount
          ? applyResellerDiscount(afterPromoTotal, resellerDiscount.discountPercent)
          : money(0);
        const lineDiscount = add(promoLineDiscount, resellerLineDiscount);
        totalResellerDiscount = add(totalResellerDiscount, resellerLineDiscount);
        const payableLineTotal = max(0, sub(lineTotal, lineDiscount));
        const taxed = calculateTax(payableLineTotal, taxRate);
        checkoutTotalAmount = add(checkoutTotalAmount, taxed.totalAmount);
        checkoutTaxAmount = add(checkoutTaxAmount, taxed.taxAmount);
        checkoutLineTotal = add(checkoutLineTotal, lineTotal);
        checkoutDiscount = add(checkoutDiscount, sub(lineTotal, payableLineTotal));
        legalItems.push({
          name: item.productName,
          quantity: item.quantity,
          period: item.billingPeriod === "yearly" ? "Yıllık" : "Aylık",
          lineTotal: toNumber(lineTotal),
        });
        const isStripe = recordMethod === "CREDIT_CARD";
        const isPaid = false;
        const waitingNote = isStripe
          ? "Kredi kartı ödemesi bekleniyor"
          : recordMethod === "BALANCE"
            ? "Bakiye ile ödeme bekleniyor"
            : "Banka havalesi bekleniyor";

        const order = await tx.order.create({
          data: {
            orderNumber: await generateOrderNumber(),
            customerId,
            productId: item.productId,
            domain:
              typeof item.configuration.domainChoice?.domain === "string"
                ? item.configuration.domainChoice.domain
                : typeof item.configuration.domain === "string"
                  ? item.configuration.domain
                  : undefined,
            billingPeriod: item.billingPeriod,
            quantity: item.quantity,
            basePrice: lineTotal,
            discountAmount: lineDiscount,
            promoCodeId: promotion?.id,
            taxRate: taxed.taxRate,
            taxAmount: taxed.taxAmount,
            totalAmount: taxed.totalAmount,
            status: isPaid ? "COMPLETED" : "PENDING",
            approvedAt: isPaid ? now : undefined,
            completedAt: isPaid ? now : undefined,
            customerNotes: [
              `Sepet ödemesi: ${waitingNote.toLocaleLowerCase("tr-TR")}`,
              resellerDiscount && isPositive(resellerLineDiscount)
                ? `Bayi indirimi uygulandı: %${resellerDiscount.discountPercent} (${resellerDiscount.resellerName})`
                : null,
            ]
              .filter(Boolean)
              .join(" | "),
            items: {
              create: {
                productName: item.productName,
                productSku: item.productSku,
                // Net amounts like InvoiceItem: totalPrice = lineTotal − discount.
                ...netOrderItemAmounts({
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  discountAmount: lineDiscount,
                }),
                configuration: item.configuration as Prisma.InputJsonValue,
              },
            },
          },
        });

        const invoice = await tx.invoice.create({
          data: {
            invoiceNumber: await generateInvoiceNumber(),
            customerId,
            orderId: order.id,
            subtotal: payableLineTotal,
            taxRate: taxed.taxRate,
            taxAmount: taxed.taxAmount,
            totalAmount: taxed.totalAmount,
            paidAmount: isPaid ? taxed.totalAmount : 0,
            status: isPaid ? "PAID" : "PENDING",
            paidAt: isPaid ? now : undefined,
            dueDate,
            notes: waitingNote,
            items: {
              create: netInvoiceLine({
                description: item.productName,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discountAmount: lineDiscount,
              }),
            },
          },
        });

        await tx.payment.create({
          data: {
            invoiceId: invoice.id,
            customerId,
            amount: taxed.totalAmount,
            method: recordMethod,
            status: isPaid ? "COMPLETED" : "PENDING",
            notes: waitingNote,
            paidAt: isPaid ? now : undefined,
          },
        });

        await tx.orderActivity.create({
          data: {
            orderId: order.id,
            action: isPaid ? "CHECKOUT_PAID" : "CHECKOUT_CREATED",
            description: `Sepet siparişi: ${waitingNote.toLocaleLowerCase("tr-TR")}`,
            performedBy: customerId,
            metadata: {
              paymentMethod: methodId,
              invoiceId: invoice.id,
              totalAmount: taxed.totalAmount,
              promoCode: promotion?.code,
              ...(resellerDiscount && isPositive(resellerLineDiscount)
                ? {
                    resellerDiscount: {
                      resellerId: resellerDiscount.resellerId,
                      discountPercent: resellerDiscount.discountPercent,
                      discountAmount: toNumber(resellerLineDiscount),
                    },
                  }
                : {}),
            },
          },
        });

        orderIds.push(order.id);
        invoiceIds.push(invoice.id);
      }

      // Checked before anything is committed: an order paid by balance is
      // only created when the balance covers it.
      if (recordMethod === "BALANCE" && compare(customer.balance, checkoutTotalAmount) < 0) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      if (promotion) {
        await claimPromotionUse(tx, promotion);
      }

      const orderNumbers = await tx.order.findMany({
        where: { id: { in: orderIds } },
        select: { orderNumber: true },
      });

      await recordCheckoutConsents(tx, {
        userId: customerId,
        orderIds,
        documents: legalDocuments,
        seller: legalSeller,
        buyer: legalBuyer,
        order: {
          date: new Intl.DateTimeFormat("tr-TR", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(now),
          numbers: orderNumbers.map((order) => order.orderNumber).join(", "),
          items: legalItems,
          subtotal: toNumber(checkoutLineTotal),
          discount: toNumber(checkoutDiscount),
          taxRate,
          tax: toNumber(checkoutTaxAmount),
          total: toNumber(checkoutTotalAmount),
          paymentMethod: legalPaymentMethodLabel(recordMethod),
        },
        ipAddress: requestMeta.ip,
        userAgent: requestMeta.userAgent,
      });

      return {
        orderIds,
        invoiceIds,
        // Plain numbers: this object is returned to the client component.
        totalAmount: toNumber(checkoutTotalAmount),
        discountAmount: toNumber(add(discountAmount, totalResellerDiscount)),
        resellerDiscountAmount: toNumber(totalResellerDiscount),
        promoCode: promotion?.code,
        orderNumbers: orderNumbers.map((order) => order.orderNumber),
      };
    });

    dispatchNotification(async () => {
      const customer = await loadCustomerRecipient(customerId);
      if (!customer) {
        return;
      }

      await sendOrderConfirmationEmail({
        customer,
        orderNumbers: result.orderNumbers,
        totalAmount: result.totalAmount,
        paymentMethod: recordMethod,
        isPaid: false,
        promoCode: result.promoCode,
      });
    });

    if (cardProvider && !stripeClient) {
      const baseUrl = getAppBaseUrl();
      const checkout = await cardProvider.createCheckout({
        customerId,
        customer: await loadCheckoutCustomer(customerId),
        invoiceIds: result.invoiceIds,
        totalAmount: result.totalAmount,
        description: `Sipariş ${result.orderNumbers.join(", ")}`,
        successUrl: `${baseUrl}/sepet/basarili`,
        cancelUrl: `${baseUrl}/sepet/iptal?invoice_ids=${result.invoiceIds.join(",")}`,
        context: "cart",
      });

      return {
        success: true,
        data: {
          ...result,
          checkoutUrl: checkout.checkoutUrl,
          checkoutHtml: checkout.checkoutHtml,
          paytrToken: checkout.paytrToken,
        },
      };
    }

    if (stripeClient) {
      const baseUrl = getAppBaseUrl();
      const session = await stripeClient.checkout.sessions.create({
        mode: "payment",
        success_url: `${baseUrl}/sepet/basarili?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/sepet/iptal?invoice_ids=${result.invoiceIds.join(",")}`,
        metadata: {
          customerId,
          invoiceIds: result.invoiceIds.join(","),
          orderIds: result.orderIds.join(","),
        },
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "try",
              unit_amount: toKurus(result.totalAmount),
              product_data: {
                name: "KLEACORE Sepet Ödemesi",
                description: result.promoCode
                  ? `Promosyon uygulandı: ${result.promoCode}`
                  : undefined,
              },
            },
          },
        ],
      });

      await persistGatewayCheckout({
        invoiceIds: result.invoiceIds,
        gatewaySessionId: session.id,
        provider: "stripe",
        customerId,
        context: "cart",
        notesPrefix: "Stripe Checkout ödemesi",
      });

      return {
        success: true,
        data: {
          ...result,
          checkoutUrl: session.url,
          stripeSessionId: session.id,
        },
      };
    }

    let paidWithBalance = false;
    if (recordMethod === "BALANCE") {
      try {
        await payInvoicesWithBalance({
          customerId,
          invoiceIds: result.invoiceIds,
          performedBy: customerId,
        });
        paidWithBalance = true;
      } catch (error) {
        // Orders stay open; the customer can pay the invoices another way.
        if (!balancePaymentErrorMessage(error)) throw error;
      }
    }

    revalidatePath("/musteri/panel");
    revalidatePath("/musteri/panel/faturalar");
    revalidatePath("/musteri/panel/hizmetlerim");
    revalidatePath("/musteri/panel/kredi");
    revalidatePath("/musteri/panel/e-posta");
    revalidatePath("/yonetim/siparisler");
    revalidatePath("/yonetim/faturalar");

    return { success: true, data: { ...result, paymentMethod: methodId, paidWithBalance } };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "LEGAL_CONSENT_MISSING") {
        return { success: false, error: LEGAL_CONSENT_REQUIRED_MESSAGE, code: "LEGAL_CONSENT_REQUIRED" as const };
      }
      if (error.message === "LEGAL_CONSENT_OUTDATED") {
        return { success: false, error: LEGAL_CONSENT_OUTDATED_MESSAGE, code: "LEGAL_CONSENT_OUTDATED" as const };
      }
      if (error.message === "INSUFFICIENT_BALANCE") {
        return { success: false, error: "Bakiyeniz bu sipariş için yeterli değil" };
      }
      if (error.message === "CUSTOMER_NOT_FOUND") {
        return { success: false, error: "Kullanıcı bulunamadı" };
      }
      if (error.message.startsWith("PRODUCT_NOT_FOUND")) {
        return { success: false, error: "Sepetteki ürünlerden biri artık satışta değil" };
      }
      if (error.message.startsWith("ADDON_NOT_FOUND")) {
        return { success: false, error: "Sepetteki eklentilerden biri artık satışta değil" };
      }
      if (error.message.startsWith("CONFIG_INVALID")) {
        const message = error.message.split(":").slice(1).join(":").trim();
        return { success: false, error: message || "Ürün yapılandırması geçersiz" };
      }
      if (error.message.startsWith("CART_INVALID:")) {
        return { success: false, error: error.message.slice("CART_INVALID:".length) };
      }
      if (error.message.startsWith("DOMAIN_TLD_NOT_FOUND")) {
        return { success: false, error: "Sepetteki domain uzantısı desteklenmiyor" };
      }
      if (error.message.startsWith("PROMO_")) {
        return { success: false, error: "Promosyon kodu geçersiz veya bu sepet için uygun değil" };
      }
    }

    return { success: false, error: "Sipariş oluşturulurken bir hata oluştu" };
  }
}
