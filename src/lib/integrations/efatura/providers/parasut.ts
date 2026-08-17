import type { EInvoiceProvider } from "../types";
import { parseParasutCredentials } from "./parasut-credentials";
import { checkParasutConnection, submitParasutEInvoiceDraft } from "./parasut-client";

export function createParasutEInvoiceProvider(apiKey: string): EInvoiceProvider {
  const credentials = parseParasutCredentials(apiKey);

  return {
    name: "parasut",
    healthCheck: async () => {
      if (!credentials) {
        return {
          ok: false,
          error:
            "Paraşüt kimlik bilgileri geçersiz. JSON veya clientId:clientSecret:username:password:companyId formatını kullanın.",
        };
      }

      try {
        await checkParasutConnection(credentials);
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "PARASUT_HEALTH_CHECK_FAILED",
        };
      }
    },
    submitDraft: async ({ draft }) => {
      if (!credentials) {
        return {
          ok: false,
          error: "PARASUT_CREDENTIALS_INVALID",
        };
      }

      try {
        const result = await submitParasutEInvoiceDraft(credentials, draft);
        return {
          ok: true,
          documentUuid: result.documentUuid,
          documentNumber: result.documentNumber,
          providerResponse: result.providerResponse,
        };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "PARASUT_SUBMIT_FAILED",
        };
      }
    },
  };
}