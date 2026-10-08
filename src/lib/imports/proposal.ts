/** zod schema of ImportProposal (stored JSON + admin edits are parsed through it). */
import { z } from "zod";
import type { ImportProposal, ImportRecord } from "./types";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-AA-GG olmalı");

export const customerProposalSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("existing"),
    userId: z.string().min(1),
    email: z.string(),
    label: z.string(),
    matchedBy: z.enum(["email", "domain", "manual"]),
  }),
  z.object({
    mode: z.literal("new"),
    email: z.string().trim().toLowerCase().email("Geçerli bir e-posta girin"),
    name: z.string().trim().min(1, "Ad gerekli").max(100),
    surname: z.string().trim().max(100).default(""),
  }),
  z.object({ mode: z.literal("none") }),
]);

export const importProposalSchema = z.object({
  action: z.enum(["import", "link", "skip"]),
  customer: customerProposalSchema,
  productId: z.string().min(1).nullable(),
  productMatchedBy: z.enum(["package", "sku", "resources", "manual"]).nullable(),
  billingPeriod: z.enum(["monthly", "quarterly", "semiannual", "yearly", "biennial", "triennial"]),
  nextDueDate: dateOnly.nullable(),
  amountOverride: z
    .string()
    .trim()
    .regex(/^(\d+([.,]\d{1,2})?)?$/, "Fiyat geçersiz (ör. 149.90)")
    .nullable()
    .transform((value) => (value ? value.replace(",", ".") : null)),
  serviceStatus: z.enum(["ACTIVE", "SUSPENDED"]),
  domainStatus: z.enum(["ACTIVE", "EXPIRED", "TRANSFERRING", "PENDING"]),
  autoRenew: z.boolean(),
  linkServiceId: z.string().nullable(),
  existingId: z.string().nullable(),
  notes: z.array(z.string()),
});

export function parseProposal(value: unknown): ImportProposal {
  return importProposalSchema.parse(value) as ImportProposal;
}

export function parseRecord(value: unknown): ImportRecord {
  const record = value as ImportRecord;
  if (!record || typeof record !== "object" || !["account", "vm", "domain"].includes(record.kind)) {
    throw new Error("IMPORT_ROW_DATA_INVALID");
  }
  return record;
}
