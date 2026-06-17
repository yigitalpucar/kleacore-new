import type { Prisma } from "@prisma/client";

function roundMoney(value: number) {
  return Number(value.toFixed(2));
}

export async function fulfillBalanceTopUp(
  tx: Prisma.TransactionClient,
  input: {
    customerId: string;
    amount: number;
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

  const amount = roundMoney(input.amount);
  const balanceBefore = Number(customer.balance);
  const balanceAfter = roundMoney(balanceBefore + amount);

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
      description: `Stripe bakiye yükleme: ${amount.toFixed(2)} TL`,
      referenceId: input.paymentReference,
    },
  });

  return {
    credited: true,
    skipped: false as const,
    balanceAfter,
    amount,
  };
}