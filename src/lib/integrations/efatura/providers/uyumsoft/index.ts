import type { EInvoiceStatus } from "@prisma/client";
import type {
  EInvoiceDocument,
  EInvoiceProvider,
  IssueResult,
  StatusResult,
  TaxpayerInfo,
} from "../../types";
import {
  buildCancelEArchiveBody,
  buildEmptyBody,
  buildGetOutboxPdfBody,
  buildGetUserAliasesBody,
  buildIsEInvoiceUserBody,
  buildQueryOutboxStatusBody,
  buildSendInvoiceBody,
} from "./requests";
import {
  UyumsoftError,
  callUyumsoft,
  type SoapTransport,
  type UyumsoftCredentials,
  type XmlNode,
} from "./soap";

/** Uyumsoft InvoiceStatus enum (from the WSDL) → our EInvoiceStatus. */
const STATUS_MAP: Record<string, EInvoiceStatus> = {
  NotPrepared: "QUEUED",
  NotSend: "QUEUED",
  Draft: "QUEUED",
  Queued: "SENT",
  Processing: "SENT",
  SentToGib: "SENT",
  WaitingForAprovement: "SENT",
  Approved: "ACCEPTED",
  Declined: "REJECTED",
  Return: "REJECTED",
  Canceled: "CANCELLED",
  EArchivedCanceled: "CANCELLED",
  Error: "FAILED",
};

export function mapUyumsoftStatus(status: string): EInvoiceStatus {
  return STATUS_MAP[status] ?? "SENT";
}

function values(result: XmlNode): XmlNode[] {
  const value = result.Value;
  return Array.isArray(value) ? (value as XmlNode[]) : value ? [value as XmlNode] : [];
}

function attr(node: XmlNode | undefined, name: string): string {
  const value = node?.[`@_${name}`];
  return typeof value === "string" ? value : "";
}

/** FlagResponse: IsSucceded only says the call ran; Value carries the answer. */
function flag(result: XmlNode) {
  return { value: attr(result, "Value") === "true", message: attr(result, "Message").replace(/\s+/g, " ").trim() };
}

/** Pick the receiver alias to address an e-Fatura to (GİB "pk" etiketi). */
export function pickReceiverAlias(result: XmlNode): string | undefined {
  const value = values(result)[0];
  const aliases = (value?.ReceiverboxAliases as XmlNode[] | undefined) ?? [];
  const enabled = aliases.filter((alias) => attr(alias, "Enabled") !== "false").map((alias) => attr(alias, "Alias"));
  return enabled.find((alias) => alias.startsWith("urn:mail:")) ?? enabled[0];
}

export function parseIssueResult(result: XmlNode, doc: EInvoiceDocument): IssueResult {
  const identity = values(result)[0];
  const uuid = attr(identity, "Id") || doc.uuid;
  const number = attr(identity, "Number");
  if (!number) {
    throw new UyumsoftError("UYUMSOFT_NO_INVOICE_NUMBER", "PARSE");
  }
  return {
    uuid,
    number,
    // Accepted into the entegratör queue; QueryOutboxInvoiceStatus tracks the rest.
    status: "SENT",
    providerStatus: "Queued",
    providerResponse: {
      id: uuid,
      number,
      scenario: attr(identity, "InvoiceScenario"),
    },
  };
}

export function parseStatusResults(result: XmlNode): Map<string, StatusResult> {
  const map = new Map<string, StatusResult>();
  for (const value of values(result)) {
    const providerStatus = attr(value, "Status");
    map.set(attr(value, "InvoiceId").toLowerCase(), {
      status: mapUyumsoftStatus(providerStatus),
      providerStatus,
      message: attr(value, "Message") || undefined,
    });
  }
  return map;
}

export function parsePdfResult(result: XmlNode): Buffer {
  const data = values(result)[0]?.Data;
  if (typeof data !== "string" || !data) {
    throw new UyumsoftError("UYUMSOFT_PDF_EMPTY", "PARSE");
  }
  return Buffer.from(data, "base64");
}

export interface UyumsoftProvider extends EInvoiceProvider {
  /** Batch status query, for the polling job. */
  getStatuses(uuids: string[]): Promise<Map<string, StatusResult>>;
}

export function createUyumsoftEInvoiceProvider(
  credentials: UyumsoftCredentials,
  transport: SoapTransport = {}
): UyumsoftProvider {
  const call = (action: string, body: string) => callUyumsoft(credentials, action, body, transport);

  const getStatuses = async (uuids: string[]) => {
    if (uuids.length === 0) return new Map<string, StatusResult>();
    return parseStatusResults(await call("QueryOutboxInvoiceStatus", buildQueryOutboxStatusBody(uuids)));
  };

  return {
    name: "uyumsoft",

    async healthCheck() {
      if (!credentials.username || !credentials.password) {
        return { ok: false, skipped: true, error: "UYUMSOFT_CREDENTIALS_MISSING" };
      }
      try {
        const result = await call("WhoAmI", buildEmptyBody("WhoAmI"));
        const info = values(result)[0];
        const customer = info?.Customer as XmlNode | undefined;
        const name = typeof customer?.Name === "string" ? customer.Name : "";
        const vkn = typeof customer?.VkTckNo === "string" ? customer.VkTckNo : "";
        return { ok: true, detail: [name, vkn && `VKN ${vkn}`].filter(Boolean).join(" · ") };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "UYUMSOFT_HEALTH_CHECK_FAILED" };
      }
    },

    async checkTaxpayer(vknTckn: string): Promise<TaxpayerInfo> {
      const result = flag(await call("IsEInvoiceUser", buildIsEInvoiceUserBody(vknTckn)));
      if (!result.value) {
        return { isEInvoiceUser: false };
      }
      const aliases = await call("GetUserAliasses", buildGetUserAliasesBody(vknTckn));
      const definition = values(aliases)[0]?.Definition as XmlNode | undefined;
      return {
        isEInvoiceUser: true,
        alias: pickReceiverAlias(aliases),
        title: attr(definition, "Title") || undefined,
      };
    },

    async issue(doc) {
      const result = await call("SendInvoice", buildSendInvoiceBody(doc));
      return parseIssueResult(result, doc);
    },

    async getStatus(uuid) {
      const status = (await getStatuses([uuid])).get(uuid.toLowerCase());
      if (!status) {
        throw new UyumsoftError("UYUMSOFT_INVOICE_NOT_FOUND", "NOT_SUCCEEDED");
      }
      return status;
    },

    getStatuses,

    async getPdf(uuid) {
      return parsePdfResult(await call("GetOutboxInvoicePdf", buildGetOutboxPdfBody(uuid)));
    },

    async cancel(uuid) {
      // The service has no reason field; the reason is kept on our record.
      const result = flag(await call("CancelEArchiveInvoice", buildCancelEArchiveBody(uuid, new Date())));
      if (!result.value) {
        throw new UyumsoftError(`UYUMSOFT_CANCEL_REFUSED: ${result.message || "iptal edilemedi"}`, "NOT_SUCCEEDED");
      }
    },
  };
}
