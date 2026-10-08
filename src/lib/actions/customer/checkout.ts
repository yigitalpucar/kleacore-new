"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  generateInvoiceNumber,
  generateOrderNumber,
} from "@/lib/utils/number-generators";
import { provisionCompletedOrder } from "@/lib/provisioning/internal";
import {
  dispatchNotification,
  loadCustomerRecipient,
  sendOrderConfirmationEmail,
} from "@/lib/notifications/email";
import { applyAffiliateCommission } from "@/lib/affiliate";
import {
  applyResellerDiscount,
  getResellerDiscountForCustomer,
} from "@/lib/reseller";
import { getAppBaseUrl, getStripe } from "@/lib/stripe";
import { persistGatewayCheckout } from "@/lib/integrations/payment-gateways/persist";
import { revalidatePath } from "next/cache";
import type { BillingPeriod, Prisma } from "@prisma/client";
import {
  CUSTOMER_PAYMENT_METHODS,
  type CustomerPaymentMethod,
} from "@/lib/payments/methods";
import { claimPromotionUse } from "@/lib/billing/promo-usage";
import { calculateTax, getTaxRate } from "@/lib/billing/tax";
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

type CheckoutPaymentMethod = CustomerPaymentMethod;

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
  paymentMethod: CheckoutPaymentMethod;
  items: CheckoutItemInput[];
  promoCode?: string;
}

const allowedPaymentMethods: CheckoutPaymentMethod[] = [...CUSTOMER_PAYMENT_METHODS];

function normalizeBillingPeriod(value: string | undefined): BillingPeriod {
  return value === "yearly" ? "yearly" : "monthly";
}

function getDomainName(item: CheckoutItemInput) {
  return item.metadata?.domain?.trim().toLowerCase() || item.id.replace(/^domain:/, "").trim().toLowerCase();
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

  if (!allowedPaymentMethods.includes(input.paymentMethod)) {
    return { success: false, error: "Geçersiz ödeme yöntemi" };
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { success: false, error: "Sepetiniz boş" };
  }

  try {
    const stripeClient = input.paymentMethod === "CREDIT_CARD" ? getStripe() : null;

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
        const domainChoice = item.metadata?.domainChoice;

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
        const isStripe = input.paymentMethod === "CREDIT_CARD";
        const isPaid = false;

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
              isStripe
                ? "Sepet ödemesi kredi kartı onayı bekliyor"
                : "Sepet ödemesi banka havalesi bekliyor",
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
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discountAmount: lineDiscount,
                totalPrice: taxed.totalAmount,
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
            notes: isStripe
              ? "Stripe ödeme onayı bekleniyor"
              : "Banka havalesi sonrası ödeme onayı bekleniyor",
            items: {
              create: {
                description: item.productName,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                totalPrice: taxed.totalAmount,
              },
            },
          },
        });

        await tx.payment.create({
          data: {
            invoiceId: invoice.id,
            customerId,
            amount: taxed.totalAmount,
            method: input.paymentMethod,
            status: isPaid ? "COMPLETED" : "PENDING",
            notes: isStripe
              ? "Stripe Checkout bekleniyor"
              : "Banka havalesi bekleniyor",
            paidAt: isPaid ? now : undefined,
          },
        });

        await tx.orderActivity.create({
          data: {
            orderId: order.id,
            action: isPaid ? "CHECKOUT_PAID" : "CHECKOUT_CREATED",
            description: isStripe
              ? "Sepet siparişi kredi kartı ödeme onayı bekliyor"
              : "Sepet siparişi banka havalesi bekliyor",
            performedBy: customerId,
            metadata: {
              paymentMethod: input.paymentMethod,
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

        if (isPaid) {
          await applyAffiliateCommission(tx, {
            customerId,
            orderTotal: taxed.totalAmount,
          });

          const provisioned = await provisionCompletedOrder(tx, order.id);

          await tx.orderActivity.create({
            data: {
              orderId: order.id,
              action: "PROVISIONED",
              description:
                "partialFailure" in provisioned && provisioned.partialFailure
                  ? "Sağlama başarısız oldu, yeniden denenecek"
                  : provisioned.type === "domain"
                    ? "Domain kaydı registrara iletildi"
                    : "Hizmet aktifleştirildi",
              performedBy: customerId,
              metadata: provisioned,
            },
          });
        }

        orderIds.push(order.id);
        invoiceIds.push(invoice.id);
      }

      if (promotion) {
        await claimPromotionUse(tx, promotion);
      }

      const orderNumbers = await tx.order.findMany({
        where: { id: { in: orderIds } },
        select: { orderNumber: true },
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
        paymentMethod: input.paymentMethod,
        isPaid: false,
        promoCode: result.promoCode,
      });
    });

    if (input.paymentMethod === "CREDIT_CARD") {
      const baseUrl = getAppBaseUrl();
      const session = await stripeClient!.checkout.sessions.create({
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

    revalidatePath("/musteri/panel");
    revalidatePath("/musteri/panel/faturalar");
    revalidatePath("/musteri/panel/hizmetlerim");
    revalidatePath("/musteri/panel/kredi");
    revalidatePath("/musteri/panel/e-posta");
    revalidatePath("/yonetim/siparisler");
    revalidatePath("/yonetim/faturalar");

    return { success: true, data: result };
  } catch (error) {
    if (error instanceof Error) {
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
