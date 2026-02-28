"use server";

import { db } from "@/lib/db";
import { requireCustomer } from "@/lib/utils/auth-helpers";
import { revalidatePath } from "next/cache";

export async function loadBalance(amount: number) {
  const session = await requireCustomer();

  try {
    if (!amount || amount <= 0) {
      return { success: false, error: "Geçerli bir tutar girin" };
    }

    if (amount > 10000) {
      return { success: false, error: "Tek seferde en fazla 10.000 TL yüklenebilir" };
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { balance: true },
    });

    if (!user) {
      return { success: false, error: "Kullanıcı bulunamadı" };
    }

    const balanceBefore = user.balance;
    const balanceAfter = balanceBefore + amount;

    await db.$transaction([
      db.user.update({
        where: { id: session.user.id },
        data: { balance: balanceAfter },
      }),
      db.transaction.create({
        data: {
          customerId: session.user.id,
          type: "DEPOSIT",
          amount,
          balanceBefore,
          balanceAfter,
          description: `Bakiye yükleme: ${amount.toFixed(2)} TL`,
        },
      }),
    ]);

    revalidatePath("/musteri/panel/kredi");
    revalidatePath("/musteri/panel");
    return { success: true, data: { balance: balanceAfter } };
  } catch {
    return { success: false, error: "Bakiye yüklenirken bir hata oluştu" };
  }
}
