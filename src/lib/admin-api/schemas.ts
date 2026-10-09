/** Shared zod pieces + serialisation helpers for admin API responses. */
import { z } from "zod/v4";
import { money as toMoney, type MoneyInput } from "@/lib/money";

export const idSchema = z.string().min(1).max(64).describe("Kayıt kimliği (cuid)");
export const idParams = z.object({ id: idSchema });

export const moneySchema = z.string().describe('Ondalık tutar, metin olarak (örn. "1234.50")');
export const dateTimeSchema = z.string().describe("ISO 8601 zaman damgası (UTC)");

export const iso = (date: Date | null | undefined) => (date ? date.toISOString() : null);
export const decimal = (value: MoneyInput | null | undefined) => (value === null || value === undefined ? null : toMoney(value).toFixed(2));

/** Empty strings from forms/agents → undefined. */
export const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

export const reasonSchema = z.string().trim().min(3, "Gerekçe en az 3 karakter olmalı").max(500);
