import { db } from "@/lib/db";
import {
  type PaginationParams,
  paginationMeta,
} from "@/lib/utils/pagination";
import type { SslStatus, SslType } from "@prisma/client";

interface GetCertificatesParams extends PaginationParams {
  status?: SslStatus;
  type?: SslType;
  customerId?: string;
}

export async function getCertificates(params: GetCertificatesParams) {
  const { page, perPage, search, sortBy, sortOrder, status, type, customerId } =
    params;

  const where = {
    ...(status && { status }),
    ...(type && { type }),
    ...(customerId && { customerId }),
    ...(search && {
      OR: [
        { domain: { contains: search, mode: "insensitive" as const } },
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
    db.sslCertificate.findMany({
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
      },
      orderBy: { [sortBy || "createdAt"]: sortOrder || "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.sslCertificate.count({ where }),
  ]);

  return { data, ...paginationMeta(total, params) };
}

export async function getCertificatesByCustomer(customerId: string) {
  return db.sslCertificate.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
  });
}
