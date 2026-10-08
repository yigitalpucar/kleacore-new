import { XMLParser } from "fast-xml-parser";
import { escapeXml } from "../../xml";

/**
 * Uyumsoft "Integration" WCF service (BasicHttpBinding over HTTPS with a
 * WS-Security UsernameToken + Timestamp). Plain fetch + a hand-written
 * envelope is all it needs; WSDL: `${endpoint}?wsdl`.
 */
export const UYUMSOFT_ENDPOINTS = {
  test: "https://efatura-test.uyumsoft.com.tr/Services/Integration",
  production: "https://efatura.uyumsoft.com.tr/Services/Integration",
} as const;

const SOAP_ACTION_BASE = "http://tempuri.org/IIntegration/";
export const TEMPURI_NS = "http://tempuri.org/";
const WSSE_NS = "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd";
const WSU_NS = "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd";
const PASSWORD_TEXT =
  "http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText";

const REQUEST_TIMEOUT_MS = 30_000;

export interface UyumsoftCredentials {
  username: string;
  password: string;
  testMode: boolean;
}

export class UyumsoftError extends Error {
  constructor(
    message: string,
    readonly code: "FAULT" | "NOT_SUCCEEDED" | "HTTP" | "PARSE" | "NETWORK",
    readonly httpStatus?: number
  ) {
    super(message);
    this.name = "UyumsoftError";
  }
}

export function uyumsoftEndpoint(testMode: boolean) {
  return testMode ? UYUMSOFT_ENDPOINTS.test : UYUMSOFT_ENDPOINTS.production;
}

export function buildSoapEnvelope(input: {
  username: string;
  password: string;
  body: string;
  now?: Date;
}): string {
  const created = input.now ?? new Date();
  const expires = new Date(created.getTime() + 5 * 60 * 1000);
  return (
    `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">` +
    `<s:Header>` +
    `<wsse:Security s:mustUnderstand="1" xmlns:wsse="${WSSE_NS}" xmlns:wsu="${WSU_NS}">` +
    `<wsu:Timestamp wsu:Id="TS-1"><wsu:Created>${created.toISOString()}</wsu:Created><wsu:Expires>${expires.toISOString()}</wsu:Expires></wsu:Timestamp>` +
    `<wsse:UsernameToken wsu:Id="UT-1"><wsse:Username>${escapeXml(input.username)}</wsse:Username>` +
    `<wsse:Password Type="${PASSWORD_TEXT}">${escapeXml(input.password)}</wsse:Password></wsse:UsernameToken>` +
    `</wsse:Security>` +
    `</s:Header>` +
    `<s:Body>${input.body}</s:Body>` +
    `</s:Envelope>`
  );
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  htmlEntities: true,
  // These repeat in responses; always give arrays so callers don't branch.
  isArray: (name) =>
    ["Value", "ReceiverboxAliases", "SenderboxAliases", "Logs"].includes(name),
});

export type XmlNode = Record<string, unknown>;

/**
 * Parse a SOAP response and return the `<Action>Result` node.
 * Throws UyumsoftError for SOAP faults and `IsSucceded="false"` results.
 */
export function parseSoapResponse(xml: string, action: string): XmlNode {
  let parsed: XmlNode;
  try {
    parsed = parser.parse(xml) as XmlNode;
  } catch {
    throw new UyumsoftError("UYUMSOFT_INVALID_XML", "PARSE");
  }

  const envelope = parsed.Envelope as XmlNode | undefined;
  const body = envelope?.Body as XmlNode | undefined;
  if (!body) {
    throw new UyumsoftError("UYUMSOFT_NO_SOAP_BODY", "PARSE");
  }

  const fault = body.Fault as XmlNode | undefined;
  if (fault) {
    const reason =
      (fault.faultstring as XmlNode | string | undefined) ??
      ((fault.Reason as XmlNode | undefined)?.Text as string | undefined);
    const message = typeof reason === "object" ? String(reason?.["#text"] ?? "") : String(reason ?? "");
    throw new UyumsoftError(`UYUMSOFT_FAULT: ${message || "SOAP fault"}`, "FAULT");
  }

  const response = body[`${action}Response`] as XmlNode | undefined;
  const result = response?.[`${action}Result`] as XmlNode | undefined;
  if (!result) {
    throw new UyumsoftError(`UYUMSOFT_NO_RESULT: ${action}`, "PARSE");
  }

  if (result["@_IsSucceded"] !== "true") {
    const message = String(result["@_Message"] ?? "").replace(/\s+/g, " ").trim();
    throw new UyumsoftError(`UYUMSOFT_${action.toUpperCase()}_FAILED: ${message || "bilinmeyen hata"}`, "NOT_SUCCEEDED");
  }

  return result;
}

export interface SoapTransport {
  fetch?: typeof fetch;
  timeoutMs?: number;
  /** Raw request/response tap (credentials are already redacted). */
  onExchange?: (exchange: { action: string; request: string; response: string; status: number }) => void;
}

export function redactEnvelope(xml: string) {
  return xml
    .replace(/<wsse:Username>[\s\S]*?<\/wsse:Username>/, "<wsse:Username>***</wsse:Username>")
    .replace(/(<wsse:Password[^>]*>)[\s\S]*?(<\/wsse:Password>)/, "$1***$2");
}

export async function callUyumsoft(
  credentials: UyumsoftCredentials,
  action: string,
  body: string,
  transport: SoapTransport = {}
): Promise<XmlNode> {
  const envelope = buildSoapEnvelope({
    username: credentials.username,
    password: credentials.password,
    body,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), transport.timeoutMs ?? REQUEST_TIMEOUT_MS);
  const doFetch = transport.fetch ?? fetch;

  let status = 0;
  let responseText = "";
  try {
    const response = await doFetch(uyumsoftEndpoint(credentials.testMode), {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: `"${SOAP_ACTION_BASE}${action}"`,
      },
      body: envelope,
      signal: controller.signal,
    });
    status = response.status;
    responseText = await response.text();
  } catch (error) {
    const reason = error instanceof Error ? (error.name === "AbortError" ? "zaman aşımı" : error.message) : "ağ hatası";
    throw new UyumsoftError(`UYUMSOFT_NETWORK: ${reason}`, "NETWORK");
  } finally {
    clearTimeout(timeout);
  }

  transport.onExchange?.({ action, request: redactEnvelope(envelope), response: responseText, status });

  // WCF returns HTTP 500 with a SOAP fault body; let the parser surface it.
  if (status >= 400 && !responseText.includes("Envelope")) {
    throw new UyumsoftError(`UYUMSOFT_HTTP_${status}`, "HTTP", status);
  }

  return parseSoapResponse(responseText, action);
}
