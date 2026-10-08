/**
 * CSV for Excel (Turkish locale): UTF-8 with BOM so "ğüşıöç" survive, `;` as
 * the separator and a decimal comma for amounts (what tr-TR Excel expects
 * when it opens a file by double click), CRLF line ends.
 *
 * Text cells that start with = + - @ (or tab/CR) are prefixed with `'` so a
 * customer name like "=HYPERLINK(...)" cannot become a formula (CSV
 * injection). Numbers are never prefixed, so negative amounts stay numbers.
 */
import { Prisma } from "@prisma/client";

export const CSV_BOM = "﻿";
export const CSV_SEPARATOR = ";";

export type CsvCell = string | number | Prisma.Decimal | boolean | Date | null | undefined;

/** Marks a cell as an amount with a fixed number of decimals ("1234,50"). */
export interface CsvAmount {
  amount: Prisma.Decimal | number | string | null | undefined;
  decimals?: number;
}

export function csvAmount(amount: CsvAmount["amount"], decimals = 2): CsvAmount {
  return { amount, decimals };
}

const FORMULA_START = /^[=+\-@\t\r]/;

function formatAmount(value: CsvAmount): string {
  if (value.amount === null || value.amount === undefined || value.amount === "") return "";
  const decimal = Prisma.Decimal.isDecimal(value.amount) ? value.amount : new Prisma.Decimal(String(value.amount));
  return decimal.toFixed(value.decimals ?? 2, Prisma.Decimal.ROUND_HALF_UP).replace(".", ",");
}

function isAmount(value: unknown): value is CsvAmount {
  return typeof value === "object" && value !== null && "amount" in value && !Prisma.Decimal.isDecimal(value) && !(value instanceof Date);
}

/** One cell as CSV text (quoted when needed). */
export function csvCell(value: CsvCell | CsvAmount): string {
  let text: string;
  let numeric = false;
  if (value === null || value === undefined) text = "";
  else if (isAmount(value)) {
    text = formatAmount(value);
    numeric = true;
  } else if (Prisma.Decimal.isDecimal(value)) {
    text = value.toString().replace(".", ",");
    numeric = true;
  } else if (typeof value === "number") {
    text = Number.isFinite(value) ? String(value).replace(".", ",") : "";
    numeric = true;
  } else if (typeof value === "boolean") text = value ? "Evet" : "Hayır";
  else if (value instanceof Date) text = Number.isNaN(value.getTime()) ? "" : value.toISOString();
  else text = String(value);

  if (!numeric && FORMULA_START.test(text)) text = `'${text}`;
  if (/[";\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(rows: Array<Array<CsvCell | CsvAmount>>, options: { bom?: boolean } = {}): string {
  const body = rows.map((row) => row.map(csvCell).join(CSV_SEPARATOR)).join("\r\n");
  return `${options.bom === false ? "" : CSV_BOM}${body}\r\n`;
}

/** ASCII-safe file name + RFC 5987 UTF-8 name for Content-Disposition. */
export function csvContentDisposition(fileName: string): string {
  const ascii = fileName
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .replace(/[^A-Za-z0-9._-]+/g, "-");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
