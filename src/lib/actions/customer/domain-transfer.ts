"use server";

import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import {
  generateInvoiceNumber,
  generateOrderNumber,
  generateTicketNumber,
} from "@/lib/utils/number-generators";
import { encryptSecret } from "@/lib/secrets/crypto";
import {
  getRegistrarConfig,
  isGriRegistrarEnabled,
} from "@/lib/integrations/registrar/config";
import { calculateDomainTransferPricing, matchDomainTld } from "@/lib/domains/transfer-pricing";
import { getTaxRate } from "@/lib/billing/tax";

export interface DomainTransferInput {
  domain: string;
  eppCode: string;
  email: string;
}

interface DomainTransferCustomer {
  id: string;
  name: string;
  surname: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  companyName: string | null;
}

async function getDomainProduct(domain: string, tx: Prisma.TransactionClient) {
  const tlds = await tx.domainTld.findMany({
    where: { isActive: true },
    orderBy: { ext: "desc" },
  });

  const tld = matchDomainTld(domain, tlds);

  if (!tld) {
    throw new Error(`DOMAIN_TLD_NOT_FOUND:${domain}`);
  }

  const sku = tld.ext === ".com.tr" ? "DOM-TR" : tld.ext === ".com" ? "DOM-COM" : null;
  const product =
    (sku
      ? await tx.product.findUnique({
          where: { sku },
          include: { category: true },
        })
      : null) ??
    (await tx.product.findFirst({
      where: {
        status: "ACTIVE",
        category: { slug: "domain" },
      },
      include: { category: true },
      orderBy: { displayOrder: "asc" },
    }));

  if (!product) {
    throw new Error("DOMAIN_PRODUCT_NOT_FOUND");
  }

  return {
    product,
    unitPrice: Number(tld.transferPrice),
    renewPrice: Number(tld.renewPrice),
    tld: tld.ext,
  };
}

async function createTransferSupportTicket(
  customer: Pick<DomainTransferCustomer, "id" | "name" | "surname">,
  normalizedDomain: string,
  eppCode: string,
  email: string,
  note?: string
) {
  const senderName = `${customer.name} ${customer.surname}`.trim() || "Müşteri";
  const ticketNumber = generateTicketNumber();

  await db.supportTicket.create({
    data: {
      ticketNumber,
      customerId: customer.id,
      subject: `Domain transfer talebi: ${normalizedDomain}`,
      department: "SALES",
      priority: "MEDIUM",
      status: "OPEN",
      messages: {
        create: {
          senderId: customer.id,
          senderName,
          senderRole: "CUSTOMER",
          message:
            `Domain: ${normalizedDomain}\n` +
            `EPP/Auth Kodu: ${eppCode}\n` +
            `İletişim E-postası: ${email}` +
            (note ? `\n\nNot: ${note}` : ""),
        },
      },
    },
  });

  revalidatePath("/musteri/panel/destek");
  revalidatePath("/yonetim/destek");

  return ticketNumber;
}

export async function isAutomatedDomainTransferAvailable() {
  const session = await auth();
  if (!session?.user?.id) {
    return { isLoggedIn: false, isAutomatedTransferAvailable: false };
  }

  const config = await getRegistrarConfig();
  return {
    isLoggedIn: true,
    isAutomatedTransferAvailable: isGriRegistrarEnabled(config),
  };
}

export async function processAutomatedDomainTransfer(
  customer: DomainTransferCustomer,
  input: DomainTransferInput
) {
  const normalizedDomain = input.domain.trim().toLowerCase();

  const existingPendingOrder = await db.order.findFirst({
    where: {
      customerId: customer.id,
      domain: normalizedDomain,
      status: { in: ["PENDING", "PROCESSING"] },
    },
    select: {
      id: true,
      orderNumber: true,
      invoice: {
        select: { id: true },
      },
    },
  });

  if (existingPendingOrder) {
    return {
      success: true as const,
      message: "Bu domain için bekleyen transfer siparişiniz zaten mevcut",
      data: {
        automated: true,
        orderNumber: existingPendingOrder.orderNumber,
        invoiceId: existingPendingOrder.invoice?.id,
      },
    };
  }

  const taxRate = await getTaxRate();

  const transactionResult = await db.$transaction(async (tx) => {
    const domainProduct = await getDomainProduct(normalizedDomain, tx);

    if (domainProduct.unitPrice <= 0) {
      throw new Error("DOMAIN_TRANSFER_PRICE_UNAVAILABLE");
    }

    const pricing = calculateDomainTransferPricing(domainProduct.unitPrice, taxRate);
    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 7);

    const order = await tx.order.create({
      data: {
        orderNumber: await generateOrderNumber(),
        customerId: customer.id,
        productId: domainProduct.product.id,
        domain: normalizedDomain,
        billingPeriod: "yearly",
        quantity: 1,
        basePrice: pricing.subtotal,
        discountAmount: 0,
        taxRate: pricing.taxRate,
        taxAmount: pricing.taxAmount,
        totalAmount: pricing.totalAmount,
        status: "PENDING",
        customerNotes: "Domain transfer siparişi - ödeme bekleniyor",
        items: {
          create: {
            productName: `${normalizedDomain} Domain Transferi`,
            productSku: domainProduct.product.sku,
            quantity: 1,
            unitPrice: pricing.subtotal,
            discountAmount: 0,
            totalPrice: pricing.totalAmount,
            configuration: {
              type: "domain_transfer",
              domain: normalizedDomain,
              tld: domainProduct.tld,
              renewPrice: domainProduct.renewPrice,
              contactEmail: input.email,
              // Needed by fulfilment to start the transfer after payment;
              // stored encrypted like other secrets.
              eppCode: encryptSecret(input.eppCode),
            },
          },
        },
      },
    });

    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber: await generateInvoiceNumber(),
        customerId: customer.id,
        orderId: order.id,
        subtotal: pricing.subtotal,
        taxRate: pricing.taxRate,
        taxAmount: pricing.taxAmount,
        totalAmount: pricing.totalAmount,
        paidAmount: 0,
        status: "PENDING",
        dueDate,
        notes: "Domain transfer ücreti - ödeme bekleniyor",
        items: {
          create: {
            description: `${normalizedDomain} Domain Transferi`,
            quantity: 1,
            unitPrice: pricing.subtotal,
            totalPrice: pricing.totalAmount,
          },
        },
      },
    });

    await tx.payment.create({
      data: {
        invoiceId: invoice.id,
        customerId: customer.id,
        amount: pricing.totalAmount,
        method: "BANK_TRANSFER",
        status: "PENDING",
        notes: "Domain transfer ücreti - banka havalesi bekleniyor",
      },
    });

    await tx.orderActivity.create({
      data: {
        orderId: order.id,
        action: "DOMAIN_TRANSFER_CREATED",
        description: "Domain transfer siparişi oluşturuldu",
        performedBy: customer.id,
        metadata: {
          domain: normalizedDomain,
          invoiceId: invoice.id,
          totalAmount: pricing.totalAmount,
        },
      },
    });

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      totalAmount: pricing.totalAmount,
    };
  });

  // The registrar transfer is started by fulfilment once this invoice is paid
  // (provisionCompletedOrder -> submitDomainToRegistrar), like every other
  // provisioning step, so an unpaid order never costs a transfer fee.
  revalidatePath("/musteri/panel/faturalar");
  revalidatePath("/yonetim/siparisler");
  revalidatePath("/yonetim/faturalar");

  return {
    success: true as const,
    message:
      `Transfer siparişiniz (${transactionResult.orderNumber}) oluşturuldu. Fatura ödendiğinde transfer otomatik olarak başlatılacaktır.`,
    data: {
      automated: true,
      orderNumber: transactionResult.orderNumber,
      invoiceId: transactionResult.invoiceId,
      invoiceNumber: transactionResult.invoiceNumber,
      totalAmount: transactionResult.totalAmount,
    },
  };
}

export async function createManualDomainTransferTicket(
  customer: Pick<DomainTransferCustomer, "id" | "name" | "surname">,
  input: DomainTransferInput
) {
  const normalizedDomain = input.domain.trim().toLowerCase();

  const existingOpenTicket = await db.supportTicket.findFirst({
    where: {
      customerId: customer.id,
      subject: `Domain transfer talebi: ${normalizedDomain}`,
      status: { not: "CLOSED" },
    },
    select: {
      ticketNumber: true,
    },
  });

  if (existingOpenTicket) {
    return {
      success: true as const,
      message: "Bu domain için açık transfer talebiniz zaten mevcut",
      data: {
        automated: false,
        ticketNumber: existingOpenTicket.ticketNumber,
      },
    };
  }

  const ticketNumber = await createTransferSupportTicket(
    customer,
    normalizedDomain,
    input.eppCode,
    input.email
  );

  return {
    success: true as const,
    message: "Transfer talebiniz alındı. Destek talebi oluşturuldu.",
    data: {
      automated: false,
      ticketNumber,
    },
  };
}

export async function submitCustomerDomainTransfer(input: DomainTransferInput) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Giriş yapmalısınız" };
  }

  const customer = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      surname: true,
      email: true,
      phone: true,
      address: true,
      city: true,
      country: true,
      companyName: true,
    },
  });

  if (!customer) {
    return { success: false, error: "Kullanıcı bulunamadı" };
  }

  const config = await getRegistrarConfig();
  if (isGriRegistrarEnabled(config)) {
    try {
      return await processAutomatedDomainTransfer(customer, input);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.startsWith("DOMAIN_TLD_NOT_FOUND")) {
          return { success: false, error: "Bu domain uzantısı için transfer fiyatı bulunamadı" };
        }
        if (error.message === "DOMAIN_TRANSFER_PRICE_UNAVAILABLE") {
          return { success: false, error: "Bu domain uzantısı için transfer fiyatı tanımlı değil" };
        }
        if (error.message === "DOMAIN_PRODUCT_NOT_FOUND") {
          return { success: false, error: "Domain ürünü yapılandırması eksik" };
        }
      }
      return { success: false, error: "Domain transferi başlatılırken bir hata oluştu" };
    }
  }

  return createManualDomainTransferTicket(customer, input);
}