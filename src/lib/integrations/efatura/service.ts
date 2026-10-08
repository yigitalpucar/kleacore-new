import { randomUUID } from "crypto";
import { Prisma, type EInvoiceRecord, type EInvoiceStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { EInvoiceBuildError, buildEInvoiceDocument, classifyTaxNumber, istanbulDateTime } from "./builder";
import {
  createEInvoiceProvider,
  getEInvoiceConfig,
  getEInvoiceConfigProblem,
  normalizeProvider,
} from "./config";
import type { UyumsoftProvider } from "./providers/uyumsoft";
import { buildUblInvoiceXml } from "./ubl";
import type {
  EInvoiceConfig,
  EInvoiceDocument,
  EInvoiceProvider,
  EInvoiceType,
  InvoiceForEInvoice,
} from "./types";

const log = createLogger("efatura");

/** A claimed issue attempt older than this is considered dead and may be retried. */
const CLAIM_TIMEOUT_MS = 2 * 60 * 1000;

export const RETRYABLE_STATUSES: EInvoiceStatus[] = ["DRAFT", "QUEUED", "FAILED"];
const FINAL_OR_IN_FLIGHT: EInvoiceStatus[] = ["SENT", "ACCEPTED", "REJECTED", "CANCELLED"];
/** Statuses that have an official document at the entegratör (PDF available). */
export const ISSUED_STATUSES: EInvoiceStatus[] = ["SENT", "ACCEPTED", "CANCELLED"];

const invoiceInclude = {
  items: true,
  payments: { select: { method: true, status: true, paidAt: true } },
  customer: {
    select: {
      name: true,
      surname: true,
      email: true,
      phone: true,
      customerType: true,
      companyName: true,
      taxNumber: true,
      taxOffice: true,
      address: true,
      city: true,
      country: true,
    },
  },
} satisfies Prisma.InvoiceInclude;

export type IssueOutcome =
  | { ok: true; record: EInvoiceRecord; skipped?: undefined }
  | { ok: false; skipped: true; reason: string; record?: EInvoiceRecord }
  | { ok: false; skipped?: undefined; error: string; record: EInvoiceRecord };

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** e-Fatura if the customer's VKN/TCKN is a registered e-Fatura user, else e-Arşiv. */
async function resolveDocumentType(
  provider: EInvoiceProvider,
  invoice: InvoiceForEInvoice
): Promise<{ type: EInvoiceType; alias?: string }> {
  const tax = classifyTaxNumber(invoice.customer.taxNumber);
  if (!tax) {
    return { type: "e-arsiv" };
  }
  const taxpayer = await provider.checkTaxpayer(tax.id);
  if (taxpayer.isEInvoiceUser && taxpayer.alias) {
    return { type: "e-fatura", alias: taxpayer.alias };
  }
  return { type: "e-arsiv" };
}

/**
 * Next local number SSSYYYYNNNNNNNNN for a configured series. Only used when
 * the admin set a prefix; otherwise Uyumsoft assigns from the portal series.
 */
async function nextDocumentNumber(prefix: string, year: string) {
  const start = `${prefix}${year}`;
  const last = await db.eInvoiceRecord.findFirst({
    where: { documentNumber: { startsWith: start } },
    orderBy: { documentNumber: "desc" },
    select: { documentNumber: true },
  });
  const sequence = last?.documentNumber ? Number(last.documentNumber.slice(start.length)) + 1 : 1;
  return `${start}${String(sequence).padStart(9, "0")}`;
}

/** Reserve a number on the record (unique index guards concurrent issuers). */
async function reserveDocumentNumber(recordId: string, prefix: string, year: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const number = await nextDocumentNumber(prefix, year);
    try {
      await db.eInvoiceRecord.update({ where: { id: recordId }, data: { documentNumber: number } });
      return number;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new Error("EFATURA_NUMBER_RESERVATION_FAILED");
}

async function findOrCreateRecord(invoice: { id: string; customerId: string }, config: EInvoiceConfig) {
  const existing = await db.eInvoiceRecord.findUnique({ where: { invoiceId: invoice.id } });
  if (existing) return existing;
  try {
    return await db.eInvoiceRecord.create({
      data: {
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        type: "e-arsiv",
        status: "QUEUED",
        provider: config.provider,
        documentUuid: randomUUID(),
      },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return db.eInvoiceRecord.findUniqueOrThrow({ where: { invoiceId: invoice.id } });
  }
}

/** Atomically take the record for one issue attempt; false if someone else holds it. */
async function claimRecord(record: EInvoiceRecord, now: Date) {
  const claimed = await db.eInvoiceRecord.updateMany({
    where: {
      id: record.id,
      status: { in: RETRYABLE_STATUSES },
      OR: [{ lastAttemptAt: null }, { lastAttemptAt: { lt: new Date(now.getTime() - CLAIM_TIMEOUT_MS) } }],
    },
    data: { lastAttemptAt: now, attempts: { increment: 1 } },
  });
  return claimed.count === 1;
}

/**
 * Issue the official e-invoice for a paid KLEACORE invoice. Idempotent: one
 * record per invoice, a stable ETTN per record, and an atomic claim per
 * attempt — safe to call from payment fulfilment, a job queue or admin retry.
 */
export async function issueEInvoiceForInvoice(invoiceId: string): Promise<IssueOutcome> {
  const config = await getEInvoiceConfig();
  const problem = getEInvoiceConfigProblem(config);
  if (problem) {
    return { ok: false, skipped: true, reason: problem };
  }

  const invoice = await db.invoice.findUnique({ where: { id: invoiceId }, include: invoiceInclude });
  if (!invoice) throw new Error("INVOICE_NOT_FOUND");
  if (invoice.status !== "PAID") throw new Error("INVOICE_NOT_PAID");

  let record = await findOrCreateRecord(invoice, config);
  if (FINAL_OR_IN_FLIGHT.includes(record.status)) {
    return { ok: true, record };
  }

  const now = new Date();
  if (!(await claimRecord(record, now))) {
    return { ok: false, skipped: true, reason: "EFATURA_IN_PROGRESS", record };
  }

  const providerName = normalizeProvider(record.provider ?? config.provider);
  const provider = createEInvoiceProvider(providerName, config);
  const uuid = record.documentUuid ?? randomUUID();

  try {
    // A previous attempt may have reached the entegratör before failing locally
    // (timeout, crash). Adopt that document instead of issuing a duplicate.
    if (record.attempts > 0 && providerName === "uyumsoft") {
      const existing = (await (provider as UyumsoftProvider).getStatuses([uuid])).get(uuid.toLowerCase());
      if (existing) {
        record = await db.eInvoiceRecord.update({
          where: { id: record.id },
          data: {
            status: existing.status === "QUEUED" ? "SENT" : existing.status,
            providerStatus: existing.providerStatus,
            statusCheckedAt: now,
            sentAt: record.sentAt ?? now,
            errorMessage: existing.status === "FAILED" ? existing.message ?? "Entegratör hatası" : null,
          },
        });
        return { ok: true, record };
      }
    }

    const { type, alias } = await resolveDocumentType(provider, invoice);
    const prefix = type === "e-arsiv" ? config.uyumsoft.earsivPrefix : config.uyumsoft.efaturaPrefix;
    const document: EInvoiceDocument = buildEInvoiceDocument(invoice, {
      supplier: config.supplier,
      type,
      profile: config.defaultProfile,
      customerAlias: alias,
      uuid,
      seriesPrefix: prefix,
      now,
    });

    if (providerName === "uyumsoft" && prefix) {
      const year = istanbulDateTime(now).date.slice(0, 4);
      const reserved = record.documentNumber?.startsWith(`${prefix}${year}`) && record.documentNumber.length === 16;
      document.number = reserved ? record.documentNumber! : await reserveDocumentNumber(record.id, prefix, year);
    }

    const xml = providerName === "uyumsoft" ? buildUblInvoiceXml(document) : undefined;
    const issued = await provider.issue(document);

    record = await db.eInvoiceRecord.update({
      where: { id: record.id },
      data: {
        type,
        profile: document.profile,
        provider: providerName,
        status: issued.status,
        providerStatus: issued.providerStatus ?? null,
        documentUuid: issued.uuid,
        documentNumber: issued.number,
        providerResponse: issued.providerResponse ?? Prisma.JsonNull,
        ublPayload: { document, xml } as unknown as Prisma.InputJsonValue,
        sentAt: now,
        errorMessage: null,
      },
    });
    return { ok: true, record };
  } catch (error) {
    const message = errorMessage(error);
    if (!(error instanceof EInvoiceBuildError)) {
      log.error("e-invoice issue failed", { invoiceId, recordId: record.id, error: message });
    }
    record = await db.eInvoiceRecord.update({
      where: { id: record.id },
      data: { status: "FAILED", documentUuid: uuid, errorMessage: message.slice(0, 2000) },
    });
    return { ok: false, error: message, record };
  }
}

/** Backwards-compatible name used by payment fulfilment. */
export async function queueEInvoiceDraft(invoiceId: string) {
  return issueEInvoiceForInvoice(invoiceId);
}

export async function retryEInvoiceRecord(recordId: string) {
  const record = await db.eInvoiceRecord.findUnique({ where: { id: recordId } });
  if (!record) throw new Error("EFATURA_RECORD_NOT_FOUND");
  if (!RETRYABLE_STATUSES.includes(record.status)) throw new Error("EFATURA_RECORD_NOT_RETRYABLE");

  // An admin retry shouldn't wait out the claim timeout of a failed attempt.
  await db.eInvoiceRecord.updateMany({
    where: { id: record.id, status: "FAILED" },
    data: { lastAttemptAt: null },
  });

  const outcome = await issueEInvoiceForInvoice(record.invoiceId);
  if (outcome.ok) return outcome.record;
  throw new Error(outcome.skipped ? outcome.reason : outcome.error);
}

/**
 * Poll the entegratör for documents still in flight. Cron/queue friendly:
 * bounded batch, oldest-checked first, never throws for a single record.
 */
export async function syncEInvoiceStatuses(options: { limit?: number } = {}) {
  const config = await getEInvoiceConfig();
  const records = await db.eInvoiceRecord.findMany({
    where: { status: "SENT", provider: "uyumsoft", documentUuid: { not: null } },
    orderBy: [{ statusCheckedAt: { sort: "asc", nulls: "first" } }, { sentAt: "asc" }],
    take: options.limit ?? 50,
    select: { id: true, documentUuid: true },
  });
  if (records.length === 0 || !config.uyumsoft.username) {
    return { checked: 0, changed: 0 };
  }

  const provider = createEInvoiceProvider("uyumsoft", config) as UyumsoftProvider;
  const statuses = await provider.getStatuses(records.map((record) => record.documentUuid!));
  const now = new Date();
  let changed = 0;

  for (const record of records) {
    const status = statuses.get(record.documentUuid!.toLowerCase());
    if (!status) {
      await db.eInvoiceRecord.update({ where: { id: record.id }, data: { statusCheckedAt: now } });
      continue;
    }
    const next = status.status === "QUEUED" ? "SENT" : status.status;
    if (next !== "SENT") changed += 1;
    await db.eInvoiceRecord.update({
      where: { id: record.id },
      data: {
        status: next,
        providerStatus: status.providerStatus,
        statusCheckedAt: now,
        errorMessage: next === "FAILED" || next === "REJECTED" ? status.message ?? status.providerStatus : null,
        ...(next === "CANCELLED" ? { cancelledAt: now } : {}),
      },
    });
  }

  return { checked: records.length, changed };
}

export async function getEInvoicePdf(invoiceId: string) {
  const record = await db.eInvoiceRecord.findUnique({ where: { invoiceId } });
  if (!record?.documentUuid || !ISSUED_STATUSES.includes(record.status)) {
    throw new Error("EFATURA_PDF_NOT_AVAILABLE");
  }
  const config = await getEInvoiceConfig();
  const provider = createEInvoiceProvider(normalizeProvider(record.provider ?? config.provider), config);
  const pdf = await provider.getPdf(record.documentUuid, record.type as EInvoiceType);
  return { pdf, filename: `${record.documentNumber || record.documentUuid}.pdf` };
}

/** Cancel an issued e-Arşiv (e-Fatura is returned via the receiver, not cancelled). */
export async function cancelEInvoiceRecord(recordId: string, reason: string) {
  const trimmed = reason.trim();
  if (trimmed.length < 3) throw new Error("EFATURA_CANCEL_REASON_REQUIRED");

  const record = await db.eInvoiceRecord.findUnique({ where: { id: recordId } });
  if (!record) throw new Error("EFATURA_RECORD_NOT_FOUND");
  if (record.type !== "e-arsiv") throw new Error("EFATURA_CANCEL_ONLY_EARSIV");
  if (!["SENT", "ACCEPTED"].includes(record.status) || !record.documentUuid) {
    throw new Error("EFATURA_RECORD_NOT_CANCELLABLE");
  }

  const config = await getEInvoiceConfig();
  const provider = createEInvoiceProvider(normalizeProvider(record.provider ?? config.provider), config);
  await provider.cancel(record.documentUuid, trimmed);

  return db.eInvoiceRecord.update({
    where: { id: record.id },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: trimmed.slice(0, 500), errorMessage: null },
  });
}
