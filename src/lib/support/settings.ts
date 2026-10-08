import { db } from "@/lib/db";

export const SUPPORT_AUTO_CLOSE_DAYS_KEY = "support_auto_close_days";
export const DEFAULT_AUTO_CLOSE_DAYS = 5;
export const MAX_AUTO_CLOSE_DAYS = 90;

export function parseAutoCloseDays(value: string | null | undefined): number {
  if (value === null || value === undefined || value.trim() === "") return DEFAULT_AUTO_CLOSE_DAYS;
  const days = Number(value);
  if (!Number.isInteger(days) || days < 0) return DEFAULT_AUTO_CLOSE_DAYS;
  return Math.min(days, MAX_AUTO_CLOSE_DAYS);
}

/** Days a ticket may wait on the customer before it is closed; 0 = never. */
export async function getAutoCloseDays(): Promise<number> {
  const row = await db.setting.findUnique({ where: { key: SUPPORT_AUTO_CLOSE_DAYS_KEY }, select: { value: true } });
  return parseAutoCloseDays(row?.value);
}

export async function setAutoCloseDays(days: number) {
  const value = String(Math.max(0, Math.min(MAX_AUTO_CLOSE_DAYS, Math.trunc(days))));
  await db.setting.upsert({
    where: { key: SUPPORT_AUTO_CLOSE_DAYS_KEY },
    create: { key: SUPPORT_AUTO_CLOSE_DAYS_KEY, value, group: "support", type: "number", label: "Otomatik kapatma (gün)" },
    update: { value },
  });
}
