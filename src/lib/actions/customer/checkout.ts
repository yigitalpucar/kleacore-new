"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events/emit";
import {
  generateInvoiceNumber,
  generateOrderNumber,
} from "@/lib/utils/number-generators";
import {
  dispatchNotification,
  loadCustomerRecipient,
  sendOrderConfirmationEmail,
} from "@/lib/notifications/email";
import { getResellerDiscountForCustomer } from "@/lib/reseller";
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
import { evaluateCheckoutOrders } from "@/lib/fraud/evaluate";
import { getFraudConfig } from "@/lib/fraud/settings";
import { withSavepoint } from "@/lib/payments/follow-ups";
import { revalidatePath } from "next/cache";
import type { BillingPeriod, Prisma } from "@prisma/client";
import { resolveCustomerPaymentMethod } from "@/lib/payments/payment-options";
import { paymentRecordMethod } from "@/lib/integrations/payment-gateways/methods-config";
import {
  balancePaymentErrorMessage,
  payInvoicesWithBalance,
} from "@/lib/payments/balance-payment";
import { claimPromotionUse } from "@/lib/billing/promo-usage";
import { getTaxRate } from "@/lib/billing/tax";
import { allocateCartLines } from "@/lib/billing/cart-pricing";
import { netInvoiceLine, netOrderItemAmounts } from "@/lib/billing/invoice-lines";
import {
  validateCartItems,
  type CartValidationError,
} from "@/lib/checkout/validate-cart";
import {
  calculatePromotion,
  getCatalogProduct,
  getDomainName,
  getDomainProduct,
  normalizeDomainChoice,
  promoAppliesToPreparedItem,
  type CheckoutItemInput,
} from "@/lib/checkout/pricing";
import { sslAllowsWildcard } from "@/lib/provisioning/internal";
import { checkDomainName } from "@/lib/validations/domain-name";
import { addonPeriodTotal } from "@/lib/billing/period-price";
import {
  add,
  compare,
  isPositive,
  money,
  mul,
  roundHalfUp,
  sub,
  sum,
  toKurus,
  toNumber,
} from "@/lib/money";


interface CheckoutInput {
  /** Method id from the picker ("kuveytturk", "bank_transfer", "balance", …) or legacy "CREDIT_CARD". */
  paymentMethod: string;
  items: CheckoutItemInput[];
  promoCode?: string;
  /** Ön bilgilendirme formu + mesafeli satış sözleşmesi versions the buyer accepted. */
  consents?: AcceptedLegalDocument[];
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
    const [legalSeller, legalBuyer, requestMeta, fraudConfig] = await Promise.all([
      getLegalSeller(),
      getLegalBuyer(customerId),
      getRequestMeta(),
      getFraudConfig(),
    ]);
    // Order risk review (docs/fraud-kyc.md): the IP country comes from the
    // shared request helper (trusted CF-IPCountry header, offline DB fallback).
    const ipCountry = { country: requestMeta.country, source: requestMeta.countrySource };
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
      const fraudOrders: Array<{ id: string; orderNumber: string; categorySlug: string }> = [];
      let checkoutTotalAmount = money(0);
      let checkoutTaxAmount = money(0);
      let checkoutLineTotal = money(0);
      let checkoutDiscount = money(0);
      const legalItems: LegalOrderItem[] = [];
      let totalResellerDiscount = money(0);
      // Per-line promo / reseller discounts and KDV (src/lib/billing/cart-pricing.ts).
      const allocatedLines = allocateCartLines(
        preparedItems.map((item) => ({
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          promoApplies: Boolean(promotion && promoAppliesToPreparedItem(promotion, item)),
        })),
        {
          promotion,
          resellerPercent: resellerDiscount ? resellerDiscount.discountPercent : null,
          taxRate,
        }
      );

      for (const [index, item] of preparedItems.entries()) {
        const { lineTotal, resellerLineDiscount, lineDiscount, payableLineTotal, taxed } = allocatedLines[index];
        totalResellerDiscount = add(totalResellerDiscount, resellerLineDiscount);
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

        await emitEvent(
          tx,
          "order.created",
          {
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerId,
            totalAmount: taxed.totalAmount,
            invoiceId: invoice.id,
            paymentMethod: methodId,
          },
          { actorId: customerId }
        );

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
        fraudOrders.push({ id: order.id, orderNumber: order.orderNumber, categorySlug: item.categorySlug });
      }

      // Checked before anything is committed: an order paid by balance is
      // only created when the balance covers it.
      if (recordMethod === "BALANCE" && compare(customer.balance, checkoutTotalAmount) < 0) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      if (promotion) {
        await claimPromotionUse(tx, promotion);
      }

      // Risk score per order; a failure here never blocks the sale (savepoint).
      const fraud = fraudConfig.enabled
        ? await withSavepoint(tx, () =>
            evaluateCheckoutOrders(
              tx,
              {
                customerId,
                ipAddress: requestMeta.ip,
                ipCountry: ipCountry.country,
                ipCountrySource: ipCountry.source,
                orders: fraudOrders,
              },
              fraudConfig
            )
          )
        : ({ ok: true, value: [] } as const);
      if (!fraud.ok) {
        console.error("[Checkout] Risk değerlendirmesi yapılamadı:", fraud.error);
      }
      const fraudOutcomes = fraud.ok ? fraud.value : [];

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
        reviewRequired: fraudOutcomes.some((outcome) => outcome.status === "REVIEW"),
        paymentBlocked: fraudOutcomes.some((outcome) => outcome.paymentBlocked),
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

    if (result.paymentBlocked) {
      // Score over the block threshold: the orders wait for a reviewer and
      // no payment session is opened (order.review_required told the customer).
      revalidatePath("/yonetim/siparisler");
      return { success: true, data: { ...result, paymentMethod: methodId, paidWithBalance: false } };
    }

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

    // Paid server orders of a customer without approved KYC are held: the
    // cart sends the customer straight to identity verification.
    const kycRequired =
      paidWithBalance &&
      (await db.order.count({
        where: { id: { in: result.orderIds }, provisioningHeldAt: { not: null }, provisioningHoldReasons: { has: "KYC" } },
      })) > 0;

    revalidatePath("/musteri/panel");
    revalidatePath("/musteri/panel/faturalar");
    revalidatePath("/musteri/panel/hizmetlerim");
    revalidatePath("/musteri/panel/kredi");
    revalidatePath("/musteri/panel/e-posta");
    revalidatePath("/yonetim/siparisler");
    revalidatePath("/yonetim/faturalar");

    return { success: true, data: { ...result, paymentMethod: methodId, paidWithBalance, kycRequired } };
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
