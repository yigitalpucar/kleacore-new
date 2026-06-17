import { db } from "@/lib/db";
import {
  type PaginationParams,
  paginationMeta,
} from "@/lib/utils/pagination";
import { Prisma } from "@prisma/client";

const billingPeriodLabels: Record<string, string> = {
  monthly: "Aylık",
  quarterly: "3 Aylık",
  semiannual: "6 Aylık",
  yearly: "Yıllık",
  biennial: "2 Yıllık",
  triennial: "3 Yıllık",
};

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function statusForAddon(status: string) {
  if (status === "PENDING") return "pending";
  if (status === "CANCELLED" || status === "REFUNDED") return "cancelled";
  return "active";
}

function isUpgradeKeyword(text: string) {
  const lowered = text.toLowerCase();
  return (
    lowered.includes("upgrade") ||
    lowered.includes("upgraded") ||
    lowered.includes("yükselt") ||
    lowered.includes("yukselt")
  );
}

function isDowngradeKeyword(text: string) {
  const lowered = text.toLowerCase();
  return (
    lowered.includes("downgrade") ||
    lowered.includes("downgraded") ||
    lowered.includes("düşür") ||
    lowered.includes("dusur")
  );
}

function mapOperationStatus(status: string) {
  if (status === "PENDING" || status === "PAYMENT_PENDING") return "pending";
  if (status === "CANCELLED") return "cancelled";
  return "completed";
}

function mapPlanChangeStatus(status: string) {
  return mapOperationStatus(status);
}

interface GetSuspendedOrdersParams extends PaginationParams {}

const suspendedOrderInclude = Prisma.validator<Prisma.OrderInclude>()({
  customer: {
    select: {
      id: true,
      name: true,
      surname: true,
      email: true,
    },
  },
  product: {
    select: {
      id: true,
      name: true,
      sku: true,
      category: {
        select: {
          name: true,
        },
      },
    },
  },
});

type SuspendedOrderRecord = Prisma.OrderGetPayload<{
  include: typeof suspendedOrderInclude;
}>;

export async function getSuspendedOrders(params: GetSuspendedOrdersParams) {
  const { page, perPage, search, sortBy, sortOrder } = params;

  const suspendedServices = await db.service.findMany({
    where: { status: "SUSPENDED" },
    select: {
      id: true,
      suspendReason: true,
    },
  });

  if (suspendedServices.length === 0) {
    return { data: [], ...paginationMeta(0, params) };
  }

  const suspendedServiceIds = suspendedServices.map((service) => service.id);
  const suspendReasonByServiceId = new Map(
    suspendedServices.map((service) => [service.id, service.suspendReason] as const)
  );

  const where: Prisma.OrderWhereInput = {
    serviceId: { in: suspendedServiceIds },
    status: { notIn: ["CANCELLED", "REFUNDED"] },
    ...(search && {
      OR: [
        { orderNumber: { contains: search, mode: "insensitive" as const } },
        {
          customer: {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
            ],
          },
        },
      ],
    }),
  };

  const [orders, total] = (await Promise.all([
    db.order.findMany({
      where,
      include: suspendedOrderInclude,
      orderBy: { [sortBy || "createdAt"]: sortOrder || "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.order.count({ where }),
  ])) as [SuspendedOrderRecord[], number];

  const data = orders.map((order) => ({
    id: order.id,
    serviceId: order.serviceId,
    orderNumber: order.orderNumber,
    status: order.status,
    totalAmount: order.totalAmount,
    createdAt: order.createdAt,
    customer: order.customer,
    product: order.product,
    suspendReason:
      (order.serviceId && suspendReasonByServiceId.get(order.serviceId)) ??
      order.cancellationReason,
  }));

  return { data, ...paginationMeta(total, params) };
}

export async function getOrderAddons() {
  const orders = await db.order.findMany({
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          surname: true,
          companyName: true,
        },
      },
      product: {
        select: {
          name: true,
          sku: true,
        },
      },
      items: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const addons = orders.flatMap((order) => {
    const addonItems = order.items.filter((item) => {
      const configuration = toRecord(item.configuration);
      const type = toStringOrNull(configuration?.type);
      const isAddonFlag = configuration?.isAddon === true || type === "addon";
      const skuMismatch = item.productSku !== order.product.sku;
      const nameHint = /addon|eklenti|ek hizmet/i.test(item.productName);
      return isAddonFlag || skuMismatch || nameHint;
    });

    return addonItems.map((item) => ({
      id: item.id,
      customer: `${order.customer.name} ${order.customer.surname}`.trim(),
      customerId: order.customer.id,
      companyName: order.customer.companyName,
      orderId: order.id,
      mainProduct: order.product.name,
      addonName: item.productName,
      price: Number(item.totalPrice),
      period: billingPeriodLabels[order.billingPeriod] ?? order.billingPeriod,
      status: statusForAddon(order.status),
      createdAt: order.createdAt.toISOString(),
    }));
  });

  return addons;
}

export async function getUpgradeDowngradeOperations() {
  const planChanges = await db.servicePlanChange.findMany({
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          surname: true,
          companyName: true,
        },
      },
      fromProduct: {
        select: { name: true },
      },
      toProduct: {
        select: { name: true },
      },
      order: {
        select: {
          id: true,
          status: true,
        },
      },
    },
    orderBy: { requestedAt: "desc" },
  });

  const fromPlanChanges = planChanges.map((change) => ({
    id: change.id,
    customer: `${change.customer.name} ${change.customer.surname}`.trim(),
    customerId: change.customer.id,
    companyName: change.customer.companyName,
    orderId: change.orderId ?? change.id,
    type: change.type === "DOWNGRADE" ? ("downgrade" as const) : ("upgrade" as const),
    fromProduct: change.fromProduct.name,
    toProduct: change.toProduct.name,
    priceDiff: Number(change.proratedAmount),
    status: mapPlanChangeStatus(change.status),
    date: change.requestedAt.toISOString(),
    planChangeId: change.id,
    canApprove: change.type === "DOWNGRADE" && change.status === "PENDING",
  }));

  const activities = await db.orderActivity.findMany({
    where: {
      OR: [
        { action: { in: ["UPGRADE", "UPGRADED", "DOWNGRADE", "DOWNGRADED"] } },
        { description: { contains: "upgrade", mode: "insensitive" } },
        { description: { contains: "downgrade", mode: "insensitive" } },
        { description: { contains: "yükselt", mode: "insensitive" } },
        { description: { contains: "yukselt", mode: "insensitive" } },
        { description: { contains: "düşür", mode: "insensitive" } },
        { description: { contains: "dusur", mode: "insensitive" } },
      ],
    },
    include: {
      order: {
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              surname: true,
              companyName: true,
            },
          },
          product: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const mapped = activities.map((activity) => {
    const metadata = toRecord(activity.metadata);
    const actionText = `${activity.action} ${activity.description}`;
    const type = isDowngradeKeyword(actionText) ? "downgrade" : "upgrade";

    const fromProduct =
      toStringOrNull(metadata?.fromProduct) ??
      toStringOrNull(metadata?.fromProductName) ??
      toStringOrNull(metadata?.oldProduct) ??
      activity.order.product.name;
    const toProduct =
      toStringOrNull(metadata?.toProduct) ??
      toStringOrNull(metadata?.toProductName) ??
      toStringOrNull(metadata?.newProduct) ??
      activity.order.product.name;
    const priceDiff =
      toNumber(metadata?.priceDiff) ??
      toNumber(metadata?.amountDiff) ??
      toNumber(metadata?.difference) ??
      0;

    return {
      id: activity.id,
      customer: `${activity.order.customer.name} ${activity.order.customer.surname}`.trim(),
      customerId: activity.order.customer.id,
      companyName: activity.order.customer.companyName,
      orderId: activity.order.id,
      type: type as "upgrade" | "downgrade",
      fromProduct,
      toProduct,
      priceDiff,
      status: mapOperationStatus(activity.order.status),
      date: activity.createdAt.toISOString(),
      planChangeId: null,
      canApprove: false,
    };
  });

  const merged = [...fromPlanChanges, ...mapped].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  if (merged.length > 0) {
    return merged;
  }

  const noteBasedOrders = await db.order.findMany({
    where: {
      OR: [
        { customerNotes: { contains: "upgrade", mode: "insensitive" } },
        { customerNotes: { contains: "downgrade", mode: "insensitive" } },
        { customerNotes: { contains: "yükselt", mode: "insensitive" } },
        { customerNotes: { contains: "yukselt", mode: "insensitive" } },
        { customerNotes: { contains: "düşür", mode: "insensitive" } },
        { customerNotes: { contains: "dusur", mode: "insensitive" } },
        { adminNotes: { contains: "upgrade", mode: "insensitive" } },
        { adminNotes: { contains: "downgrade", mode: "insensitive" } },
        { adminNotes: { contains: "yükselt", mode: "insensitive" } },
        { adminNotes: { contains: "yukselt", mode: "insensitive" } },
        { adminNotes: { contains: "düşür", mode: "insensitive" } },
        { adminNotes: { contains: "dusur", mode: "insensitive" } },
      ],
    },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          surname: true,
          companyName: true,
        },
      },
      product: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return noteBasedOrders.map((order) => {
    const note = `${order.customerNotes ?? ""} ${order.adminNotes ?? ""}`;
    const type = isDowngradeKeyword(note) ? "downgrade" : "upgrade";

    return {
      id: order.id,
      customer: `${order.customer.name} ${order.customer.surname}`.trim(),
      customerId: order.customer.id,
      companyName: order.customer.companyName,
      orderId: order.id,
      type: type as "upgrade" | "downgrade",
      fromProduct: order.product.name,
      toProduct: order.product.name,
      priceDiff: 0,
      status: mapOperationStatus(order.status),
      date: order.updatedAt.toISOString(),
      planChangeId: null,
      canApprove: false,
    };
  });
}

export async function getCancellationRequests() {
  const requests = await db.cancellationRequest.findMany({
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          surname: true,
          companyName: true,
        },
      },
      service: {
        select: {
          id: true,
          product: { select: { name: true } },
        },
      },
      order: {
        select: {
          id: true,
          refundAmount: true,
          product: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return requests.map((request) => {
    const statusMap: Record<string, string> = {
      PENDING: "pending",
      APPROVED: "approved",
      REJECTED: "rejected",
    };

    const productName =
      request.service?.product.name ??
      request.order?.product.name ??
      "Bilinmeyen ürün";

    return {
      id: request.id,
      customer: `${request.customer.name} ${request.customer.surname}`.trim(),
      customerId: request.customer.id,
      companyName: request.customer.companyName,
      orderId: request.orderId ?? request.order?.id ?? "",
      serviceId: request.serviceId,
      product: productName,
      reason: request.reason,
      requestedAt: request.createdAt.toISOString(),
      resolvedAt: request.resolvedAt?.toISOString() ?? null,
      status: statusMap[request.status] ?? request.status.toLowerCase(),
      adminNotes: request.adminNotes,
      refundAmount: request.order?.refundAmount ?? 0,
    };
  });
}
