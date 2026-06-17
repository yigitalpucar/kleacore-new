import type { SslProvider, SslProvisionInput } from "../types";

export function createSectigoSslProvider(apiKey: string): SslProvider {
  return {
    name: "sectigo",
    provisionCertificate: async (input: SslProvisionInput) => {
      const orderRef = `sectigo-${input.certificateId.slice(-8)}`;

      return {
        ok: true,
        status: "PENDING",
        provider: "sectigo",
        certificateId: input.certificateId,
        externalId: orderRef,
        providerResponse: {
          mode: "api-stub",
          orderRef,
          domain: input.domain,
          type: input.type,
          status: "awaiting_csr",
          message: "Sectigo API entegrasyonu yakında — CSR gönderimi bekleniyor",
        },
      };
    },
    healthCheck: async () => ({
      ok: Boolean(apiKey.trim()),
      error: apiKey.trim() ? undefined : "SSL_SECTIGO_API_KEY_REQUIRED",
    }),
  };
}