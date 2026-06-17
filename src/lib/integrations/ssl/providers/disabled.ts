import type { SslProvider } from "../types";

const NOT_CONFIGURED = "SSL_NOT_CONFIGURED";

export function createDisabledSslProvider(): SslProvider {
  return {
    name: "disabled",
    provisionCertificate: async () => ({
      ok: false,
      skipped: true,
      error: NOT_CONFIGURED,
    }),
    healthCheck: async () => ({
      ok: false,
      skipped: true,
      error: NOT_CONFIGURED,
    }),
  };
}