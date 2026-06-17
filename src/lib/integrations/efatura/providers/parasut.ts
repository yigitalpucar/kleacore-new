import type { EInvoiceProvider } from "../types";

export function createParasutEInvoiceProvider(_apiKey: string): EInvoiceProvider {
  return {
    name: "parasut",
    submitDraft: async () => ({
      ok: false,
      error: "PARASUT_PROVIDER_NOT_IMPLEMENTED",
    }),
    healthCheck: async () => ({
      ok: false,
      error: "PARASUT_PROVIDER_NOT_IMPLEMENTED",
    }),
  };
}