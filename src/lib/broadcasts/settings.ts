import { db } from "@/lib/db";

/** Messages (recipient × channel) handed to the mail/SMS queue per minute. */
export const BROADCAST_RATE_KEY = "broadcast_rate_per_minute";
export const DEFAULT_BROADCAST_RATE = 60;
export const MIN_BROADCAST_RATE = 1;
export const MAX_BROADCAST_RATE = 1000;

export function clampBroadcastRate(value: unknown) {
  const number = Math.trunc(Number(value));
  if (!Number.isFinite(number) || number < MIN_BROADCAST_RATE) return DEFAULT_BROADCAST_RATE;
  return Math.min(MAX_BROADCAST_RATE, number);
}

export async function getBroadcastRate() {
  const row = await db.setting.findUnique({ where: { key: BROADCAST_RATE_KEY }, select: { value: true } });
  return row?.value ? clampBroadcastRate(row.value) : DEFAULT_BROADCAST_RATE;
}

export async function setBroadcastRate(value: number) {
  const rate = Math.min(MAX_BROADCAST_RATE, Math.max(MIN_BROADCAST_RATE, Math.trunc(value)));
  await db.setting.upsert({
    where: { key: BROADCAST_RATE_KEY },
    create: { key: BROADCAST_RATE_KEY, value: String(rate), group: "notifications", type: "number", label: "Toplu duyuru hızı (mesaj/dakika)" },
    update: { value: String(rate) },
  });
  return rate;
}
