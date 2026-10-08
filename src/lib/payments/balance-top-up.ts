import type { Prisma } from "@prisma/client";
import { add, roundHalfUp, toFixed2, toNumber, type MoneyInput } from "@/lib/money";

export async function fulfillBalanceTopUp(
  tx: Prisma.TransactionClient,
  input: {
    customerId: string;
    amount: MoneyInput;
    paymentReference: string;
  }
) {
  const existing = await tx.transaction.findFirst({
    where: {
      customerId: input.customerId,
      referenceId: input.paymentReference,
      type: "DEPOSIT",
    },
    select: { id: true },
  });

  if (existing) {
    return { credited: false, skipped: true as const };
  }

  const customer = await tx.user.findUnique({
    where: { id: input.customerId },
    select: { balance: true },
  });

  if (!customer) {
    throw new Error("CUSTOMER_NOT_FOUND");
  }

  const amount = roundHalfUp(input.amount);
  const balanceBefore = customer.balance;
  const balanceAfter = add(balanceBefore, amount);

  await tx.user.update({
    where: { id: input.customerId },
    data: { balance: balanceAfter },
  });

  await tx.transaction.create({
    data: {
      customerId: input.customerId,
      type: "DEPOSIT",
      amount,
      balanceBefore,
      balanceAfter,
      description: `Stripe bakiye yükleme: ${toFixed2(amount)} TL`,
      referenceId: input.paymentReference,
    },
  });

  return {
    credited: true,
    skipped: false as const,
    balanceAfter: toNumber(balanceAfter),
    amount: toNumber(amount),
  };
}