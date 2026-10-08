import { z } from "zod";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { formatTRY } from "@/lib/format/price";

/**
 * Amounts arrive as numbers, Decimal strings or Prisma Decimals (serialised
 * to strings through JSON). Display only — never used for arithmetic.
 */
export const moneyField = z.union([z.number(), z.string()]).transform((value) => String(value));

/** Dates are JSON strings by the time a queued job renders them. */
export const dateField = z
  .union([z.date(), z.string()])
  .transform((value) => (value instanceof Date ? value : new Date(value)))
  .refine((value) => !Number.isNaN(value.getTime()), "Geçersiz tarih");

/** Every template schema starts with the recipient's name, filled in by sendNotification. */
export function templateSchema<T extends z.ZodRawShape>(shape: T) {
  return z.object({ recipientName: z.string().optional(), ...shape });
}

export function money(value: string) {
  return formatTRY(Number(value), { keepDecimals: true });
}

export function date(value: Date) {
  return formatDate(value);
}

export function dateTime(value: Date) {
  return formatDateTime(value);
}

export const panelPaths = {
  dashboard: "/musteri/panel",
  invoice: (id: string) => `/musteri/panel/faturalar/${id}`,
  invoices: "/musteri/panel/faturalar",
  service: (id: string) => `/musteri/panel/hizmetlerim/${id}`,
  services: "/musteri/panel/hizmetlerim",
  domains: "/musteri/panel/domainler",
  ticket: (id: string) => `/musteri/panel/destek/${id}`,
  security: "/musteri/panel/ayarlar",
  affiliate: "/musteri/panel/satis-ortakligi",
};
