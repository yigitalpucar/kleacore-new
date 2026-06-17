import type { EInvoiceProvider } from "../types";

export function createDisabledEInvoiceProvider(): EInvoiceProvider {
  return {
    name: "disabled",
    submitDraft: async () => ({
      ok: false,
      skipped: true,
      error: "EFATURA_NOT_CONFIGURED",
    }),
    healthCheck: async () => ({
      ok: false,
      skipped: true,
      error: "EFATURA_NOT_CONFIGURED",
    }),
  };
}