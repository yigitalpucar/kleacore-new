"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { encryptSecret } from "@/lib/secrets/crypto";
import { MAX_AUTO_CLOSE_DAYS, setAutoCloseDays } from "@/lib/support/settings";
import { requireAdmin } from "@/lib/utils/auth-helpers";

const PATH = "/yonetim/destek/ayarlar";

const mailboxSchema = z.object({
  name: z.string().trim().min(2, "Ad en az 2 karakter olmalı").max(80),
  address: z.string().trim().toLowerCase().email("Geçerli bir e-posta adresi girin"),
  host: z
    .string()
    .trim()
    .min(3, "Sunucu adresi gerekli")
    .max(253)
    .regex(/^[a-zA-Z0-9.-]+$/, "Sunucu adresi yalnızca harf, rakam, nokta ve tire içerebilir"),
  port: z.coerce.number().int().min(1).max(65535),
  secure: z.boolean(),
  username: z.string().trim().min(1, "Kullanıcı adı gerekli").max(254),
  /** Empty on update = keep the stored password. */
  password: z.string().max(500).optional(),
  folder: z.string().trim().min(1).max(200).default("INBOX"),
  processedFolder: z.string().trim().max(200).optional().nullable(),
  department: z.enum(["GENERAL", "TECHNICAL", "BILLING", "SALES"]).nullable().optional(),
  isActive: z.boolean(),
});

export type MailboxInput = z.input<typeof mailboxSchema>;

function firstError(error: z.ZodError) {
  return error.errors[0]?.message ?? "Geçersiz bilgiler";
}

export async function saveSupportMailbox(id: string | null, input: MailboxInput) {
  await requireAdmin();
  const parsed = mailboxSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: firstError(parsed.error) };
  const { password, processedFolder, department, ...rest } = parsed.data;
  const data = {
    ...rest,
    processedFolder: processedFolder?.trim() || null,
    department: department ?? null,
  };

  if (id) {
    const result = await db.supportMailbox.updateMany({
      where: { id },
      data: { ...data, ...(password ? { password: encryptSecret(password) } : {}) },
    });
    if (result.count === 0) return { success: false as const, error: "Posta kutusu bulunamadı" };
  } else {
    if (!password) return { success: false as const, error: "Parola gerekli" };
    await db.supportMailbox.create({ data: { ...data, password: encryptSecret(password) } });
  }
  revalidatePath(PATH);
  return { success: true as const };
}

export async function deleteSupportMailbox(id: string) {
  await requireAdmin();
  await db.supportMailbox.deleteMany({ where: { id } });
  revalidatePath(PATH);
  return { success: true as const };
}

/** Login + open folder with the stored credentials; reads nothing. */
export async function testSupportMailbox(id: string) {
  await requireAdmin();
  const mailbox = await db.supportMailbox.findUnique({ where: { id } });
  if (!mailbox) return { success: false as const, error: "Posta kutusu bulunamadı" };
  try {
    const { testMailboxConnection } = await import("@/lib/support/inbound/poller");
    const result = await testMailboxConnection(mailbox);
    return { success: true as const, data: result };
  } catch (error) {
    return { success: false as const, error: `Bağlantı başarısız: ${error instanceof Error ? error.message : String(error)}`.slice(0, 300) };
  }
}

/** Runs one poll of all active mailboxes now (same code path as the cron). */
export async function pollSupportMailboxesNow() {
  await requireAdmin();
  const { runCronWithLock } = await import("@/lib/cron/run-log");
  const { pollSupportMailboxes } = await import("@/lib/support/inbound/poller");
  try {
    const outcome = await runCronWithLock("support-mail", () => pollSupportMailboxes());
    revalidatePath(PATH);
    revalidatePath("/yonetim/destek");
    if (outcome.status !== "succeeded") return { success: false as const, error: "Başka bir okuma sürüyor, biraz sonra tekrar deneyin." };
    return { success: true as const, data: outcome.result };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Okuma başarısız" };
  }
}

export async function saveAutoCloseDays(days: number) {
  await requireAdmin();
  if (!Number.isInteger(days) || days < 0 || days > MAX_AUTO_CLOSE_DAYS) {
    return { success: false as const, error: `0 ile ${MAX_AUTO_CLOSE_DAYS} arasında bir gün sayısı girin (0 = kapalı)` };
  }
  await setAutoCloseDays(days);
  revalidatePath(PATH);
  return { success: true as const };
}
