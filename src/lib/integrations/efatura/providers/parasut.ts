import { EInvoiceNotSupportedError, type EInvoiceProvider } from "../types";
import { parseParasutCredentials } from "./parasut-credentials";
import {
  checkParasutConnection,
  findParasutEInvoiceInbox,
  submitParasutEInvoiceDraft,
} from "./parasut-client";

const INVALID_CREDENTIALS =
  "Paraşüt kimlik bilgileri geçersiz. JSON veya clientId:clientSecret:username:password:companyId formatını kullanın.";

/**
 * Optional provider. Paraşüt issues the official document asynchronously
 * through its own trackable jobs, so status/PDF/cancel stay in Paraşüt's UI.
 */
export function createParasutEInvoiceProvider(apiKey: string): EInvoiceProvider {
  const credentials = parseParasutCredentials(apiKey);
  const requireCredentials = () => {
    if (!credentials) throw new Error("PARASUT_CREDENTIALS_INVALID");
    return credentials;
  };

  return {
    name: "parasut",
    healthCheck: async () => {
      if (!credentials) {
        return { ok: false, error: INVALID_CREDENTIALS };
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
    checkTaxpayer: async (vknTckn) => {
      const inbox = await findParasutEInvoiceInbox(requireCredentials(), vknTckn);
      return inbox
        ? { isEInvoiceUser: true, alias: inbox.alias, title: inbox.title }
        : { isEInvoiceUser: false };
    },
    issue: async (doc) => {
      const result = await submitParasutEInvoiceDraft(requireCredentials(), doc);
      return {
        uuid: result.documentUuid,
        number: result.documentNumber,
        status: "SENT",
        providerResponse: result.providerResponse,
      };
    },
    getStatus: async () => {
      throw new EInvoiceNotSupportedError("parasut", "getStatus");
    },
    getPdf: async () => {
      throw new EInvoiceNotSupportedError("parasut", "getPdf");
    },
    cancel: async () => {
      throw new EInvoiceNotSupportedError("parasut", "cancel");
    },
  };
}
