import type {
  Backup,
  Domain,
  Invoice,
  InvoiceItem,
  Order,
  OrderActivity,
  OrderItem,
  Payment,
  Product,
  ProductCategory,
  Service,
  SupportTicket,
} from "@prisma/client";
import { toNumber, toNumberOrNull } from "@/lib/money";

type InvoiceWithRelations = Invoice & {
  items: InvoiceItem[];
  payments?: Payment[];
  order?: { id: string; orderNumber: string } | null;
};

type TicketWithCounts = SupportTicket & {
  _count?: { messages: number };
};

export function serializeInvoiceSummary(invoice: InvoiceWithRelations) {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    subtotal: toNumber(invoice.subtotal),
    taxRate: toNumber(invoice.taxRate),
    taxAmount: toNumber(invoice.taxAmount),
    totalAmount: toNumber(invoice.totalAmount),
    paidAmount: toNumber(invoice.paidAmount),
    issuedAt: invoice.issuedAt.toISOString(),
    dueDate: invoice.dueDate.toISOString(),
    paidAt: invoice.paidAt?.toISOString() ?? null,
    createdAt: invoice.createdAt.toISOString(),
    updatedAt: invoice.updatedAt.toISOString(),
    items: invoice.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: toNumber(item.unitPrice),
      discountAmount: toNumber(item.discountAmount),
      /** Net (KDV hariç) satır toplamı; KDV fatura düzeyinde (taxAmount). */
      totalPrice: toNumber(item.totalPrice),
    })),
    paymentCount: invoice.payments?.length ?? 0,
  };
}

export function serializeInvoiceDetail(invoice: InvoiceWithRelations) {
  return {
    ...serializeInvoiceSummary(invoice),
    notes: invoice.notes,
    order: invoice.order
      ? {
          id: invoice.order.id,
          orderNumber: invoice.order.orderNumber,
        }
      : null,
    payments: (invoice.payments ?? []).map((payment) => ({
      id: payment.id,
      amount: toNumber(payment.amount),
      method: payment.method,
      status: payment.status,
      paidAt: payment.paidAt?.toISOString() ?? null,
      createdAt: payment.createdAt.toISOString(),
    })),
  };
}

export function serializeTicketSummary(ticket: TicketWithCounts) {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    subject: ticket.subject,
    department: ticket.department,
    priority: ticket.priority,
    status: ticket.status,
    relatedServiceId: ticket.relatedServiceId,
    messageCount: ticket._count?.messages ?? 0,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    closedAt: ticket.closedAt?.toISOString() ?? null,
  };
}

type ProductSummary = Pick<Product, "id" | "name" | "sku"> & {
  category: Pick<ProductCategory, "id" | "name" | "slug">;
};

type ServiceWithProduct = Service & {
  product: ProductSummary;
};

type ServiceDetailWithRelations = ServiceWithProduct & {
  backups?: Pick<Backup, "id" | "type" | "status" | "size" | "createdAt">[];
};

type OrderWithRelations = Order & {
  product: ProductSummary;
  items: OrderItem[];
};

type OrderDetailWithRelations = OrderWithRelations & {
  activities?: OrderActivity[];
  invoice?: { id: string; invoiceNumber: string; status: string } | null;
  promoCode?: { id: string; code: string } | null;
};

type DomainWithCounts = Domain & {
  _count?: { dnsRecords: number };
};

function serializeProductSummary(product: ProductSummary) {
  return {
    id: product.id,
    name: product.name,
    sku: product.sku,
    category: {
      id: product.category.id,
      name: product.category.name,
      slug: product.category.slug,
    },
  };
}

export function serializeServiceSummary(service: ServiceWithProduct) {
  return {
    id: service.id,
    label: service.label,
    domain: service.domain,
    ipAddress: service.ipAddress,
    status: service.status,
    billingPeriod: service.billingPeriod,
    amount: toNumber(service.amount),
    nextDueDate: service.nextDueDate?.toISOString() ?? null,
    expiresAt: service.expiresAt?.toISOString() ?? null,
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
    product: serializeProductSummary(service.product),
  };
}

export function serializeServiceDetail(service: ServiceDetailWithRelations) {
  return {
    ...serializeServiceSummary(service),
    username: service.username,
    serverName: service.serverName,
    diskUsed: service.diskUsed,
    diskLimit: service.diskLimit,
    bandwidthUsed: service.bandwidthUsed,
    bandwidthLimit: service.bandwidthLimit,
    cpuUsage: service.cpuUsage,
    ramUsage: service.ramUsage,
    suspendedAt: service.suspendedAt?.toISOString() ?? null,
    cancelledAt: service.cancelledAt?.toISOString() ?? null,
    suspendReason: service.suspendReason,
    backups: (service.backups ?? []).map((backup) => ({
      id: backup.id,
      type: backup.type,
      status: backup.status,
      size: backup.size,
      createdAt: backup.createdAt.toISOString(),
    })),
  };
}

export function serializeOrderSummary(order: OrderWithRelations) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    domain: order.domain,
    billingPeriod: order.billingPeriod,
    quantity: order.quantity,
    basePrice: toNumber(order.basePrice),
    discountAmount: toNumber(order.discountAmount),
    setupFee: toNumber(order.setupFee),
    taxRate: toNumber(order.taxRate),
    taxAmount: toNumber(order.taxAmount),
    totalAmount: toNumber(order.totalAmount),
    serviceId: order.serviceId,
    invoiceId: order.invoiceId,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    product: serializeProductSummary(order.product),
    itemCount: order.items.length,
  };
}

export function serializeOrderDetail(order: OrderDetailWithRelations) {
  return {
    ...serializeOrderSummary(order),
    approvedAt: order.approvedAt?.toISOString() ?? null,
    processingStartedAt: order.processingStartedAt?.toISOString() ?? null,
    completedAt: order.completedAt?.toISOString() ?? null,
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
    cancellationReason: order.cancellationReason,
    refundedAt: order.refundedAt?.toISOString() ?? null,
    refundAmount: toNumberOrNull(order.refundAmount),
    customerNotes: order.customerNotes,
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      productSku: item.productSku,
      quantity: item.quantity,
      unitPrice: toNumber(item.unitPrice),
      discountAmount: toNumber(item.discountAmount),
      totalPrice: toNumber(item.totalPrice),
      configuration: item.configuration,
    })),
    activities: (order.activities ?? []).map((activity) => ({
      id: activity.id,
      action: activity.action,
      description: activity.description,
      performedBy: activity.performedBy,
      createdAt: activity.createdAt.toISOString(),
    })),
    invoice: order.invoice
      ? {
          id: order.invoice.id,
          invoiceNumber: order.invoice.invoiceNumber,
          status: order.invoice.status,
        }
      : null,
    promoCode: order.promoCode
      ? {
          id: order.promoCode.id,
          code: order.promoCode.code,
        }
      : null,
  };
}

export function serializeDomainSummary(domain: DomainWithCounts) {
  return {
    id: domain.id,
    name: domain.name,
    status: domain.status,
    registrar: domain.registrar,
    registeredAt: domain.registeredAt.toISOString(),
    expiresAt: domain.expiresAt.toISOString(),
    autoRenew: domain.autoRenew,
    privacyEnabled: domain.privacyEnabled,
    dnsRecordCount: domain._count?.dnsRecords ?? 0,
    createdAt: domain.createdAt.toISOString(),
    updatedAt: domain.updatedAt.toISOString(),
  };
}

export function serializeDomainDetail(domain: DomainWithCounts) {
  return {
    ...serializeDomainSummary(domain),
    nameservers: domain.nameservers,
    whoisName: domain.whoisName,
    whoisEmail: domain.whoisEmail,
    whoisPhone: domain.whoisPhone,
    whoisAddress: domain.whoisAddress,
  };
}