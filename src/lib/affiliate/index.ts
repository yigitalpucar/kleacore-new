import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { generateAffiliateCode } from "@/lib/utils/number-generators";
import { isPositive, mul, roundHalfUp, type MoneyInput } from "@/lib/money";

export const AFFILIATE_REF_COOKIE = "kleacore_ref";
export const AFFILIATE_REF_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
export const AFFILIATE_COMMISSION_RATE = 0.1;

type DbClient = Prisma.TransactionClient | typeof db;

export { getSafeRedirectPath } from "@/lib/utils/safe-redirect";

export async function generateUniqueAffiliateCode(
  client: DbClient,
  name: string
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateAffiliateCode(name);
    const existing = await client.user.findUnique({
      where: { affiliateCode: code },
      select: { id: true },
    });

    if (!existing) {
      return code;
    }
  }

  return `${generateAffiliateCode(name)}${Date.now().toString(36).slice(-4)}`;
}

export async function resolveAffiliateByRefCode(
  client: DbClient,
  refCode: string | null | undefined
) {
  const normalizedCode = refCode?.trim();
  if (!normalizedCode) {
    return null;
  }

  return client.user.findFirst({
    where: {
      affiliateCode: normalizedCode,
      status: "ACTIVE",
    },
    select: {
      id: true,
      affiliateCode: true,
    },
  });
}

interface CreateCustomerUserInput {
  name: string;
  surname: string;
  email: string;
  password: string;
  phone?: string | null;
}

export async function createCustomerUser(
  client: DbClient,
  input: CreateCustomerUserInput,
  refCode?: string | null
) {
  const affiliate = await resolveAffiliateByRefCode(client, refCode);
  const affiliateCode = await generateUniqueAffiliateCode(client, input.name);

  return client.user.create({
    data: {
      name: input.name,
      surname: input.surname,
      email: input.email,
      phone: input.phone ?? null,
      password: input.password,
      role: "CUSTOMER",
      status: "ACTIVE",
      affiliateCode,
      referredById: affiliate?.id,
      ...(affiliate
        ? {
            referredReferrals: {
              create: {
                affiliateId: affiliate.id,
              },
            },
          }
        : {}),
    },
  });
}

export async function applyAffiliateCommission(
  tx: Prisma.TransactionClient,
  input: { customerId: string; orderTotal: MoneyInput }
) {
  if (!isPositive(input.orderTotal)) {
    return;
  }

  const commissionAmount = roundHalfUp(mul(input.orderTotal, AFFILIATE_COMMISSION_RATE));
  if (!isPositive(commissionAmount)) {
    return;
  }

  const referral = await tx.affiliateReferral.findFirst({
    where: { referredId: input.customerId },
    select: { id: true },
  });

  if (!referral) {
    return;
  }

  await tx.affiliateReferral.update({
    where: { id: referral.id },
    data: {
      commission: { increment: commissionAmount },
    },
  });
}