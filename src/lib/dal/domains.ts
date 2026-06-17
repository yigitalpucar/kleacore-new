import { db } from "@/lib/db";
import {
  type PaginationParams,
  paginationMeta,
} from "@/lib/utils/pagination";
import type { DomainStatus } from "@prisma/client";

interface GetDomainsParams extends PaginationParams {
  status?: DomainStatus;
  customerId?: string;
}

export async function getDomains(params: GetDomainsParams) {
  const { page, perPage, search, sortBy, sortOrder, status, customerId } =
    params;

  const where = {
    ...(status && { status }),
    ...(customerId && { customerId }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
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

  const [data, total] = await Promise.all([
    db.domain.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            surname: true,
            email: true,
          },
        },
        _count: {
          select: { dnsRecords: true },
        },
      },
      orderBy: { [sortBy || "createdAt"]: sortOrder || "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.domain.count({ where }),
  ]);

  return { data, ...paginationMeta(total, params) };
}

export async function getDomainById(id: string) {
  return db.domain.findUnique({
    where: { id },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          surname: true,
          email: true,
          phone: true,
        },
      },
      _count: {
        select: { dnsRecords: true },
      },
    },
  });
}

export async function getDomainByIdOrName(identifier: string) {
  const byId = await getDomainById(identifier);
  if (byId) {
    return byId;
  }

  const normalizedName = identifier.trim().toLowerCase();
  if (!normalizedName.includes(".")) {
    return null;
  }

  return db.domain.findUnique({
    where: { name: normalizedName },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          surname: true,
          email: true,
          phone: true,
        },
      },
      _count: {
        select: { dnsRecords: true },
      },
    },
  });
}

export async function getDomainWithDns(id: string) {
  return db.domain.findUnique({
    where: { id },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          surname: true,
          email: true,
        },
      },
      dnsRecords: {
        orderBy: { type: "asc" },
      },
    },
  });
}

export async function getDomainsByCustomer(customerId: string) {
  return db.domain.findMany({
    where: { customerId },
    include: {
      _count: {
        select: { dnsRecords: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
