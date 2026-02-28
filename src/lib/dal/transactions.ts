import { db } from "@/lib/db";
import {
  type PaginationParams,
  paginationMeta,
} from "@/lib/utils/pagination";
import type { TransactionType } from "@prisma/client";

interface GetTransactionsParams extends PaginationParams {
  type?: TransactionType;
}

export async function getTransactions(customerId: string) {
  return db.transaction.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTransactionsByCustomer(
  customerId: string,
  params: GetTransactionsParams
) {
  const { page, perPage, search, sortBy, sortOrder, type } = params;

  const where = {
    customerId,
    ...(type && { type }),
    ...(search && {
      description: { contains: search, mode: "insensitive" as const },
    }),
  };

  const [data, total] = await Promise.all([
    db.transaction.findMany({
      where,
      orderBy: { [sortBy || "createdAt"]: sortOrder || "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.transaction.count({ where }),
  ]);

  return { data, ...paginationMeta(total, params) };
}
