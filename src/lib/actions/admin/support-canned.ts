"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/utils/auth-helpers";

const cannedReplySchema = z.object({
  title: z.string().trim().min(2, "Başlık en az 2 karakter olmalı").max(120, "Başlık en fazla 120 karakter olabilir"),
  body: z.string().trim().min(2, "Yanıt metni boş olamaz").max(10_000, "Yanıt metni çok uzun"),
  department: z.enum(["GENERAL", "TECHNICAL", "BILLING", "SALES"]).nullable().optional(),
});

export type CannedReplyInput = z.input<typeof cannedReplySchema>;

function revalidate() {
  revalidatePath("/yonetim/destek/hazir-yanitlar");
  revalidatePath("/yonetim/destek/[id]", "page");
}

export async function createCannedReply(input: CannedReplyInput) {
  const session = await requireAdmin();
  const parsed = cannedReplySchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.errors[0]?.message ?? "Geçersiz bilgiler" };
  const reply = await db.cannedReply.create({
    data: { ...parsed.data, department: parsed.data.department ?? null, createdById: session.user.id },
    select: { id: true },
  });
  revalidate();
  return { success: true as const, data: reply };
}

export async function updateCannedReply(id: string, input: CannedReplyInput) {
  await requireAdmin();
  const parsed = cannedReplySchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.errors[0]?.message ?? "Geçersiz bilgiler" };
  const result = await db.cannedReply.updateMany({
    where: { id },
    data: { ...parsed.data, department: parsed.data.department ?? null },
  });
  if (result.count === 0) return { success: false as const, error: "Hazır yanıt bulunamadı" };
  revalidate();
  return { success: true as const };
}

export async function deleteCannedReply(id: string) {
  await requireAdmin();
  await db.cannedReply.deleteMany({ where: { id } });
  revalidate();
  return { success: true as const };
}

/** Counted when inserted into a reply (sorting by usage on the reply screen). */
export async function markCannedReplyUsed(id: string) {
  await requireAdmin();
  await db.cannedReply.updateMany({ where: { id }, data: { usageCount: { increment: 1 } } });
  return { success: true as const };
}
