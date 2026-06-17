import type { SslProvider, SslProvisionInput } from "../types";

function buildChallengeToken(domain: string) {
  const normalized = domain.replace(/[^a-z0-9]/gi, "").toLowerCase();
  return `acme-challenge-${normalized}-${Date.now().toString(36)}`;
}

export function createLetsEncryptSslProvider(acmeEmail: string): SslProvider {
  return {
    name: "letsencrypt",
    provisionCertificate: async (input: SslProvisionInput) => {
      const challengeToken = buildChallengeToken(input.domain);

      return {
        ok: true,
        status: "PENDING",
        provider: "letsencrypt",
        certificateId: input.certificateId,
        externalId: challengeToken,
        providerResponse: {
          mode: "acme-stub",
          acmeEmail,
          domain: input.domain,
          type: input.type,
          status: "pending_validation",
          ownershipCheck: {
            method: "dns-01",
            recordName: `_acme-challenge.${input.domain}`,
            recordValue: challengeToken,
            validated: false,
            message: "Domain ownership validation placeholder — DNS kaydı eklenmeli",
          },
          nextStep: "active",
          note: "Sertifika doğrulama tamamlandığında ACTIVE durumuna geçer",
        },
      };
    },
    healthCheck: async () => ({
      ok: Boolean(acmeEmail.trim()),
      error: acmeEmail.trim() ? undefined : "SSL_ACME_EMAIL_REQUIRED",
    }),
  };
}