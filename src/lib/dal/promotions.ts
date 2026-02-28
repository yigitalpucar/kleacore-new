import { db } from "@/lib/db";
import type { PromoCodeStatus } from "@prisma/client";

interface GetPromotionsParams {
  status?: PromoCodeStatus;
  search?: string;
}

export async function getPromotions(params?: GetPromotionsParams) {
  const { status, search } = params || {};

  const where = {
    ...(status && { status }),
    ...(search && {
      OR: [
        { code: { contains: search, mode: "insensitive" as const } },
        { name: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  return db.promotionCode.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
}

export async function getPromotionById(id: string) {
  return db.promotionCode.findUnique({
    where: { id },
  });
}
