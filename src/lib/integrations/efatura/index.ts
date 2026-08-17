import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSettingMap, isEnabled } from "../settings";
import { buildUblTrDraft } from "./builder";
import { createDisabledEInvoiceProvider } from "./providers/disabled";

import { createParasutEInvoiceProvider } from "./providers/parasut";
import type { EInvoiceConfig, EInvoiceProvider, EInvoiceProviderName } from "./types";

export type {
  EInvoiceDraft,
  EInvoiceProvider,
  EInvoiceType,
  InvoiceForEInvoice,
  UblInvoice,
} from "./types";
export { buildUblTrDraft } from "./builder";

const EFATURA_SETTING_KEYS = [
  { key: "efatura_enabled", fallback: "false" },
  { key: "efatura_provider", fallback: "disabled" },
  { key: "efatura_api_key" },
  { key: "efatura_company_vkn" },
] as const;

function normalizeProvider(value: string | undefined): EInvoiceProviderName {
  if (value === "parasut") {
    return value;
  }
  return "disabled";
}

export async function getEInvoiceConfig(): Promise<EInvoiceConfig> {
  const settings = await getSettingMap([...EFATURA_SETTING_KEYS]);

  return {
    enabled: isEnabled(settings.efatura_enabled),
    provider: normalizeProvider(settings.efatura_provider),
    apiKey: settings.efatura_api_key,
    companyVkn: settings.efatura_company_vkn,
  };
}

export function isEInvoiceConfigured(config: EInvoiceConfig): boolean {
  if (!config.enabled || config.provider === "disabled") {
    return false;
  }

  if (!config.companyVkn.trim()) {
    return false;
  }

  if (config.provider === "parasut" && !config.apiKey.trim()) {
    return false;
  }

  return true;
}

export async function getEInvoiceProvider(): Promise<EInvoiceProvider> {
  const config = await getEInvoiceConfig();

  if (!config.enabled || config.provider === "disabled") {
    return createDisabledEInvoiceProvider();
  }

  if (!config.companyVkn.trim()) {
    return createDisabledEInvoiceProvider();
  }

  if (config.provider === "parasut") {
    if (!config.apiKey.trim()) {
      return createDisabledEInvoiceProvider();
    }
    return createParasutEInvoiceProvider(config.apiKey);
  }

  return createDisabledEInvoiceProvider();
}

export async function queueEInvoiceDraft(invoiceId: string) {
  const config = await getEInvoiceConfig();

  if (!isEInvoiceConfigured(config)) {
    return null;
  }

  const existing = await db.eInvoiceRecord.findUnique({
    where: { invoiceId },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      items: true,
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
    },
  });

  if (!invoice) {
    throw new Error("INVOICE_NOT_FOUND");
  }

  if (invoice.status !== "PAID") {
    throw new Error("INVOICE_NOT_PAID");
  }

  const draft = buildUblTrDraft(invoice, config.companyVkn);
  const provider = await getEInvoiceProvider();

  const record = await db.eInvoiceRecord.create({
    data: {
      invoiceId: invoice.id,
      customerId: invoice.customerId,
      type: draft.type,
      status: "QUEUED",
      documentUuid: draft.ubl.uuid,
      documentNumber: draft.ubl.id,
      ublPayload: draft.ubl as unknown as Prisma.InputJsonValue,
    },
  });

  try {
    const result = await provider.submitDraft({
      draft,
      recordId: record.id,
    });

    if (!result.ok) {
      await db.eInvoiceRecord.update({
        where: { id: record.id },
        data: {
          status: result.skipped ? "DRAFT" : "FAILED",
          errorMessage: result.error ?? "EFATURA_SUBMIT_FAILED",
          providerResponse: result.providerResponse ?? undefined,
        },
      });
      return record;
    }

    await db.eInvoiceRecord.update({
      where: { id: record.id },
      data: {
        status: "SENT",
        documentUuid: result.documentUuid ?? draft.ubl.uuid,
        documentNumber: result.documentNumber ?? draft.ubl.id,
        providerResponse: result.providerResponse ?? undefined,
        sentAt: new Date(),
        errorMessage: null,
      },
    });
  } catch (error) {
    await db.eInvoiceRecord.update({
      where: { id: record.id },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "EFATURA_SUBMIT_FAILED",
      },
    });
    throw error;
  }

  return record;
}

export async function retryEInvoiceRecord(recordId: string) {
  const config = await getEInvoiceConfig();

  if (!isEInvoiceConfigured(config)) {
    throw new Error("EFATURA_NOT_CONFIGURED");
  }

  const record = await db.eInvoiceRecord.findUnique({
    where: { id: recordId },
    include: {
      invoice: {
        include: {
          items: true,
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
        },
      },
    },
  });

  if (!record) {
    throw new Error("EFATURA_RECORD_NOT_FOUND");
  }

  if (!["FAILED", "DRAFT", "QUEUED"].includes(record.status)) {
    throw new Error("EFATURA_RECORD_NOT_RETRYABLE");
  }

  if (record.invoice.status !== "PAID") {
    throw new Error("INVOICE_NOT_PAID");
  }

  const draft = buildUblTrDraft(record.invoice, config.companyVkn);
  const provider = await getEInvoiceProvider();

  await db.eInvoiceRecord.update({
    where: { id: record.id },
    data: {
      status: "QUEUED",
      errorMessage: null,
      documentUuid: draft.ubl.uuid,
      documentNumber: draft.ubl.id,
      ublPayload: draft.ubl as unknown as Prisma.InputJsonValue,
    },
  });

  const result = await provider.submitDraft({
    draft,
    recordId: record.id,
  });

  if (!result.ok) {
    await db.eInvoiceRecord.update({
      where: { id: record.id },
      data: {
        status: result.skipped ? "DRAFT" : "FAILED",
        errorMessage: result.error ?? "EFATURA_SUBMIT_FAILED",
        providerResponse: result.providerResponse ?? undefined,
      },
    });
    throw new Error(result.error ?? "EFATURA_SUBMIT_FAILED");
  }

  await db.eInvoiceRecord.update({
    where: { id: record.id },
    data: {
      status: "SENT",
      documentUuid: result.documentUuid ?? draft.ubl.uuid,
      documentNumber: result.documentNumber ?? draft.ubl.id,
      providerResponse: result.providerResponse ?? undefined,
      sentAt: new Date(),
      errorMessage: null,
    },
  });

  return record;
}