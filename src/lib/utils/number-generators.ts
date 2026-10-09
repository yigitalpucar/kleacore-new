import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

/**
 * Document series backed by the `number_sequences` counter table. The source
 * table/column are only used once per prefix+year to seed the counter after the
 * highest existing number, so legacy random numbers (F-2026-5500) never clash.
 */
const SERIES = {
  invoice: { prefix: "F", table: "invoices", column: "invoiceNumber" },
  order: { prefix: "S", table: "orders", column: "orderNumber" },
  dataRequest: { prefix: "KVKK", table: "data_requests", column: "requestNumber" },
} as const;

type SeriesName = keyof typeof SERIES;

const SEQUENCE_DIGITS = 6;

export function formatDocumentNumber(prefix: string, year: number, value: number): string {
  return `${prefix}-${year}-${String(value).padStart(SEQUENCE_DIGITS, "0")}`;
}

/**
 * Atomically reserves the next value of a series. Runs on its own (autocommit)
 * statement rather than the caller's transaction so the counter row is never
 * locked for the length of a checkout; a rolled-back checkout leaves a gap,
 * which is acceptable — numbers stay unique and increasing.
 */
async function nextSequenceValue(
  series: SeriesName,
  year: number
): Promise<number> {
  const { prefix, table, column } = SERIES[series];
  const key = `${series}:${prefix}:${year}`;

  const updated = await db.$queryRaw<Array<{ value: number }>>`
    UPDATE "number_sequences"
    SET "value" = "value" + 1, "updatedAt" = now()
    WHERE "key" = ${key}
    RETURNING "value"
  `;

  if (updated.length > 0) {
    return Number(updated[0].value);
  }

  // First number of this prefix+year: seed after the highest existing one.
  // ON CONFLICT covers two requests racing to create the row.
  const pattern = `^${prefix}-${year}-([0-9]+)$`;
  const inserted = await db.$queryRaw<Array<{ value: number }>>`
    INSERT INTO "number_sequences" ("key", "value", "updatedAt")
    SELECT ${key},
           COALESCE(MAX(substring(${Prisma.raw(`"${column}"`)} from ${pattern})::bigint), 0) + 1,
           now()
    FROM ${Prisma.raw(`"${table}"`)}
    WHERE ${Prisma.raw(`"${column}"`)} ~ ${pattern}
    ON CONFLICT ("key") DO UPDATE
      SET "value" = "number_sequences"."value" + 1, "updatedAt" = now()
    RETURNING "value"
  `;

  if (inserted.length === 0) {
    throw new Error("NUMBER_SEQUENCE_UNAVAILABLE");
  }

  return Number(inserted[0].value);
}

export async function generateOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const value = await nextSequenceValue("order", year);
  return formatDocumentNumber(SERIES.order.prefix, year, value);
}

export async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const value = await nextSequenceValue("invoice", year);
  return formatDocumentNumber(SERIES.invoice.prefix, year, value);
}

export async function generateDataRequestNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const value = await nextSequenceValue("dataRequest", year);
  return formatDocumentNumber(SERIES.dataRequest.prefix, year, value);
}

export function generateTicketNumber(): string {
  const random = Math.floor(100000 + Math.random() * 900000);
  return `T-${random}`;
}

export function generateAffiliateCode(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 6);
  const random = Math.floor(100 + Math.random() * 900);
  return `${slug}${random}`;
}
