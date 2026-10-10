"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireCustomer } from "@/lib/utils/auth-helpers";

/** "Kapat" on the panel home checklist: hidden for this account from now on. */
export async function dismissOnboarding() {
  const session = await requireCustomer();
  await db.user.updateMany({
    where: { id: session.user.id, onboardingDismissedAt: null },
    data: { onboardingDismissedAt: new Date() },
  });
  revalidatePath("/musteri/panel");
  return { success: true as const };
}
