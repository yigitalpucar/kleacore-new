import type { EInvoiceProvider } from "../types";

const notConfigured = async (): Promise<never> => {
  throw new Error("EFATURA_NOT_CONFIGURED");
};

export function createDisabledEInvoiceProvider(): EInvoiceProvider {
  return {
    name: "disabled",
    healthCheck: async () => ({
      ok: false,
      skipped: true,
      error: "EFATURA_NOT_CONFIGURED",
    }),
    checkTaxpayer: notConfigured,
    issue: notConfigured,
    getStatus: notConfigured,
    getPdf: notConfigured,
    cancel: notConfigured,
  };
}
