/**
 * Kuveyt Türk Sanal POS (3D Model, API "TDV2.0.0") wire format: hashes,
 * KuveytTurkVPosMessage XML, AuthenticationResponse / provision parsing and
 * the WCF SOAP messages for iptal (SaleReversal) and iade (DrawBack /
 * PartialDrawback). Pure functions only — no I/O, no logging — so every
 * message can be unit tested. Sources: docs/payments-kuveytturk.md.
 *
 * Card data (PAN, CVV, expiry) only ever passes through
 * `buildPaymentRequestXml`; callers must keep the result in memory and never
 * log or persist it.
 */
import { createHash, randomBytes } from "crypto";
import { timingSafeStringEqual } from "@/lib/secrets/compare";

export const KUVEYTTURK_API_VERSION = "TDV2.0.0";
export const KUVEYTTURK_CURRENCY_TRY = "0949";
export const KUVEYTTURK_SUCCESS_CODE = "00";

const SOAP_SERVICE_NAMESPACE = "http://boa.net/BOA.Integration.VirtualPos/Service";
const SOAP_ACTION_PREFIX = `${SOAP_SERVICE_NAMESPACE}/IVirtualPosService/`;

export const KUVEYTTURK_ENDPOINTS = {
  test: {
    payGate: "https://boatest.kuveytturk.com.tr/boa.virtualpos.services/Home/ThreeDModelPayGate",
    provisionGate:
      "https://boatest.kuveytturk.com.tr/boa.virtualpos.services/Home/ThreeDModelProvisionGate",
    soap: "https://boatest.kuveytturk.com.tr/BOA.Integration.WCFService/BOA.Integration.VirtualPos/VirtualPosService.svc/Basic",
  },
  production: {
    payGate: "https://sanalpos.kuveytturk.com.tr/ServiceGateWay/Home/ThreeDModelPayGate",
    provisionGate: "https://sanalpos.kuveytturk.com.tr/ServiceGateWay/Home/ThreeDModelProvisionGate",
    soap: "https://boa.kuveytturk.com.tr/BOA.Integration.WCFService/BOA.Integration.VirtualPos/VirtualPosService.svc/Basic",
  },
} as const;

export function getKuveytTurkEndpoints(testMode: boolean) {
  return testMode ? KUVEYTTURK_ENDPOINTS.test : KUVEYTTURK_ENDPOINTS.production;
}

export interface KuveytTurkCredentials {
  merchantId: string;
  customerId: string;
  username: string;
  password: string;
}

export interface KuveytTurkCard {
  holderName: string;
  /** Digits only. */
  number: string;
  /** "01".."12" */
  expireMonth: string;
  /** Two digits ("29"). */
  expireYear: string;
  cvv: string;
}

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

// ISO-8859-9 (Latin-5) equals Latin-1 except for six Turkish letters.
const LATIN5_OVERRIDES: Record<string, number> = {
  Ğ: 0xd0,
  İ: 0xdd,
  Ş: 0xde,
  ğ: 0xf0,
  ı: 0xfd,
  ş: 0xfe,
};

// Latin-1 code points whose slot Latin-5 gives to a Turkish letter.
const LATIN5_REPLACED = new Set([0xd0, 0xdd, 0xde, 0xf0, 0xfd, 0xfe]);

/** The bank hashes ISO-8859-9 bytes; unmappable characters become "?". */
export function toIso88599Bytes(value: string) {
  const bytes: number[] = [];
  for (const char of value) {
    const override = LATIN5_OVERRIDES[char];
    if (override !== undefined) {
      bytes.push(override);
      continue;
    }
    const code = char.codePointAt(0) ?? 0x3f;
    bytes.push(code <= 0xff && !LATIN5_REPLACED.has(code) ? code : 0x3f);
  }
  return Buffer.from(bytes);
}

export function sha1Base64(value: string) {
  return createHash("sha1").update(toIso88599Bytes(value)).digest("base64");
}

/** HashedPassword = base64(sha1(Password)). */
export function hashKuveytTurkPassword(password: string) {
  return sha1Base64(password);
}

/**
 * ThreeDModelPayGate (kart doğrulama) HashData:
 * MerchantId + MerchantOrderId + Amount + OkUrl + FailUrl + UserName + HashedPassword
 */
export function buildPaymentHash(
  credentials: KuveytTurkCredentials,
  input: { merchantOrderId: string; amountKurus: number; okUrl: string; failUrl: string }
) {
  return sha1Base64(
    `${credentials.merchantId}${input.merchantOrderId}${input.amountKurus}${input.okUrl}${input.failUrl}${credentials.username}${hashKuveytTurkPassword(credentials.password)}`
  );
}

/**
 * ThreeDModelProvisionGate and WCF (iptal/iade) HashData — no URLs:
 * MerchantId + MerchantOrderId + Amount + UserName + HashedPassword
 */
export function buildProvisionHash(
  credentials: KuveytTurkCredentials,
  input: { merchantOrderId: string; amountKurus: number }
) {
  return sha1Base64(
    `${credentials.merchantId}${input.merchantOrderId}${input.amountKurus}${credentials.username}${hashKuveytTurkPassword(credentials.password)}`
  );
}

/**
 * HashData the bank puts in a successful AuthenticationResponse:
 * MerchantOrderId + ResponseCode + OrderId + HashedPassword
 */
export function buildAuthenticationResponseHash(
  password: string,
  input: { merchantOrderId: string; responseCode: string; orderId: string }
) {
  return sha1Base64(
    `${input.merchantOrderId}${input.responseCode}${input.orderId}${hashKuveytTurkPassword(password)}`
  );
}

// ---------------------------------------------------------------------------
// Amounts / identifiers
// ---------------------------------------------------------------------------

/** 102.65 TL → 10265 (Amount and DisplayAmount are integer kuruş). */
export function toKurus(amount: number) {
  return Math.round(amount * 100);
}

/** Letters and digits only, 20 chars, unique per 3-D attempt. */
export function createMerchantOrderId() {
  return `KC${Date.now().toString(36).toUpperCase()}${randomBytes(5).toString("hex").toUpperCase()}`.slice(
    0,
    20
  );
}

export function detectCardType(cardNumber: string): "Visa" | "MasterCard" | "Troy" | "" {
  if (/^(9792|65)/.test(cardNumber)) return "Troy";
  if (/^4/.test(cardNumber)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(cardNumber)) return "MasterCard";
  return "";
}

// ---------------------------------------------------------------------------
// XML helpers
// ---------------------------------------------------------------------------

export function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decodeXmlEntities(value: string) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (match, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower === "lt") return "<";
    if (lower === "gt") return ">";
    if (lower === "amp") return "&";
    if (lower === "quot") return '"';
    if (lower === "apos") return "'";
    const codePoint = lower.startsWith("#x")
      ? Number.parseInt(lower.slice(2), 16)
      : Number.parseInt(lower.slice(1), 10);
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
  });
}

type XmlNode = string | number | boolean | XmlTree;
type XmlTree = Array<[string, XmlNode]>;

function renderXml(tree: XmlTree, prefix = ""): string {
  return tree
    .map(([name, value]) => {
      const tag = `${prefix}${name}`;
      const inner = Array.isArray(value)
        ? renderXml(value, prefix)
        : escapeXml(typeof value === "boolean" ? (value ? "true" : "false") : String(value));
      return `<${tag}>${inner}</${tag}>`;
    })
    .join("");
}

/** Inner XML of the first `<name>` element (any namespace prefix), or null. */
function findElement(xml: string, name: string): string | null {
  const pattern = new RegExp(
    `<(?:[\\w.-]+:)?${name}(?:\\s[^>]*)?(?:/>|>([\\s\\S]*?)</(?:[\\w.-]+:)?${name}>)`
  );
  const match = pattern.exec(xml);
  if (!match) return null;
  return match[1] ?? "";
}

/** Text of `path` ("VPosMessage/Amount"), entity-decoded and trimmed. */
export function readXmlValue(xml: string, path: string): string | undefined {
  let scope: string | null = xml;
  for (const segment of path.split("/")) {
    scope = scope === null ? null : findElement(scope, segment);
  }
  if (scope === null) return undefined;
  return decodeXmlEntities(scope).trim();
}

// ---------------------------------------------------------------------------
// 3-D payment (ThreeDModelPayGate)
// ---------------------------------------------------------------------------

export interface PaymentRequestInput {
  merchantOrderId: string;
  amountKurus: number;
  okUrl: string;
  failUrl: string;
  card: KuveytTurkCard;
  clientIp: string;
  cardHolder: {
    email: string;
    phone?: string | null;
    city?: string | null;
    address?: string | null;
  };
}

function phoneSubscriber(phone: string | null | undefined) {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return null;
  // +90 5xx… / 0 5xx… / 5xx… → 5xxxxxxxxx
  const national = digits.replace(/^(90|0)(?=5\d{9}$)/, "");
  return national.slice(-15);
}

/**
 * KuveytTurkVPosMessage for ThreeDModelPayGate. Taksit is not offered:
 * InstallmentCount is always 0 (tek çekim).
 */
export function buildPaymentRequestXml(credentials: KuveytTurkCredentials, input: PaymentRequestInput) {
  const subscriber = phoneSubscriber(input.cardHolder.phone);
  const cardHolderData: XmlTree = [
    ["BillAddrCity", (input.cardHolder.city?.trim() || "İstanbul").slice(0, 50)],
    ["BillAddrCountry", "792"],
    ["BillAddrLine1", (input.cardHolder.address?.trim() || "Türkiye").slice(0, 150)],
    ["BillAddrPostCode", "34000"],
    ["BillAddrState", "34"],
    ["Email", input.cardHolder.email.slice(0, 254)],
  ];
  if (subscriber) {
    cardHolderData.push([
      "MobilePhone",
      [
        ["Cc", "90"],
        ["Subscriber", subscriber],
      ],
    ]);
  }

  const tree: XmlTree = [
    ["APIVersion", KUVEYTTURK_API_VERSION],
    ["OkUrl", input.okUrl],
    ["FailUrl", input.failUrl],
    [
      "HashData",
      buildPaymentHash(credentials, {
        merchantOrderId: input.merchantOrderId,
        amountKurus: input.amountKurus,
        okUrl: input.okUrl,
        failUrl: input.failUrl,
      }),
    ],
    ["MerchantId", credentials.merchantId],
    ["CustomerId", credentials.customerId],
    ["UserName", credentials.username],
    [
      "DeviceData",
      [
        ["DeviceChannel", "02"],
        ["ClientIP", input.clientIp],
      ],
    ],
    ["CardHolderData", cardHolderData],
    ["CardNumber", input.card.number],
    ["CardExpireDateYear", input.card.expireYear],
    ["CardExpireDateMonth", input.card.expireMonth],
    ["CardCVV2", input.card.cvv],
    ["CardHolderName", input.card.holderName.slice(0, 64)],
    ["CardType", detectCardType(input.card.number)],
    ["TransactionType", "Sale"],
    ["InstallmentCount", 0],
    ["Amount", input.amountKurus],
    ["DisplayAmount", input.amountKurus],
    ["CurrencyCode", KUVEYTTURK_CURRENCY_TRY],
    ["MerchantOrderId", input.merchantOrderId],
    ["TransactionSecurity", 3],
  ];

  return `<?xml version="1.0" encoding="UTF-8"?><KuveytTurkVPosMessage xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">${renderXml(tree)}</KuveytTurkVPosMessage>`;
}

// ---------------------------------------------------------------------------
// AuthenticationResponse (posted by the bank to OkUrl / FailUrl)
// ---------------------------------------------------------------------------

export interface AuthenticationResponse {
  responseCode: string;
  responseMessage: string;
  merchantOrderId: string;
  orderId: string;
  hashData?: string;
  md?: string;
  /** VPosMessage/Amount in kuruş, when present. */
  amountKurus?: number;
  currencyCode?: string;
  installmentCount?: string;
}

/**
 * The form field carries URL-encoded XML ("%3C%3Fxml…"). Form decoding
 * already happened once; decode the inner layer when it is still encoded.
 */
export function decodeAuthenticationResponseField(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.startsWith("<")) return trimmed;
  try {
    return decodeURIComponent(trimmed.replace(/\+/g, " "));
  } catch {
    return trimmed;
  }
}

function parseKurus(value: string | undefined) {
  if (value === undefined || value === "") return undefined;
  return /^\d+$/.test(value) ? Number(value) : Number.NaN;
}

export function parseAuthenticationResponse(xml: string): AuthenticationResponse | null {
  if (!/<VPosTransactionResponseContract|<VPosTransaction/.test(xml)) return null;

  // Top-level fields appear after </VPosMessage>; strip the nested message so
  // its OrderId/MerchantOrderId never shadow the top-level ones.
  const vposMessage = findElement(xml, "VPosMessage") ?? "";
  const topLevel = xml.replace(/<VPosMessage[\s\S]*?<\/VPosMessage>/, "");

  return {
    responseCode: readXmlValue(topLevel, "ResponseCode") ?? "",
    responseMessage: readXmlValue(topLevel, "ResponseMessage") ?? "",
    merchantOrderId:
      readXmlValue(topLevel, "MerchantOrderId") || readXmlValue(vposMessage, "MerchantOrderId") || "",
    orderId: readXmlValue(topLevel, "OrderId") ?? "",
    hashData: readXmlValue(topLevel, "HashData") || undefined,
    md: readXmlValue(topLevel, "MD") || undefined,
    amountKurus: parseKurus(readXmlValue(vposMessage, "Amount")),
    currencyCode: readXmlValue(vposMessage, "CurrencyCode") || undefined,
    installmentCount: readXmlValue(vposMessage, "InstallmentCount") || undefined,
  };
}

/** Constant-time check of the HashData on a successful AuthenticationResponse. */
export function verifyAuthenticationResponseHash(password: string, response: AuthenticationResponse) {
  if (!response.hashData || !password) return false;
  const expected = buildAuthenticationResponseHash(password, {
    merchantOrderId: response.merchantOrderId,
    responseCode: response.responseCode,
    orderId: response.orderId,
  });
  return timingSafeStringEqual(expected, response.hashData);
}

/** Bank currency codes ("949" / "0949") → ISO code for verifyGatewayAmount. */
export function mapKuveytTurkCurrency(code: string | undefined) {
  if (!code) return undefined;
  return code.replace(/^0+/, "") === "949" ? "TRY" : code;
}

// ---------------------------------------------------------------------------
// Provision (ThreeDModelProvisionGate)
// ---------------------------------------------------------------------------

export function buildProvisionRequestXml(
  credentials: KuveytTurkCredentials,
  input: { merchantOrderId: string; amountKurus: number; md: string; clientIp?: string }
) {
  const tree: XmlTree = [
    ["APIVersion", KUVEYTTURK_API_VERSION],
    [
      "HashData",
      buildProvisionHash(credentials, {
        merchantOrderId: input.merchantOrderId,
        amountKurus: input.amountKurus,
      }),
    ],
    ["MerchantId", credentials.merchantId],
    ["CustomerId", credentials.customerId],
    ["UserName", credentials.username],
    ...(input.clientIp ? ([["CustomerIPAddress", input.clientIp]] as XmlTree) : []),
    ["TransactionType", "Sale"],
    ["InstallmentCount", 0],
    ["Amount", input.amountKurus],
    ["DisplayAmount", input.amountKurus],
    ["CurrencyCode", KUVEYTTURK_CURRENCY_TRY],
    ["MerchantOrderId", input.merchantOrderId],
    ["TransactionSecurity", 3],
    [
      "KuveytTurkVPosAdditionalData",
      [
        [
          "AdditionalData",
          [
            ["Key", "MD"],
            ["Data", input.md],
          ],
        ],
      ],
    ],
  ];

  return `<?xml version="1.0" encoding="UTF-8"?><KuveytTurkVPosMessage xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">${renderXml(tree)}</KuveytTurkVPosMessage>`;
}

export interface ProvisionResponse {
  responseCode: string;
  responseMessage: string;
  merchantOrderId: string;
  orderId: string;
  provisionNumber: string;
  rrn: string;
  stan: string;
  amountKurus?: number;
  currencyCode?: string;
  /** Masked by the bank ("518896******2544"); we keep only the last four. */
  cardLast4?: string;
  hashData?: string;
}

export function parseProvisionResponse(xml: string): ProvisionResponse {
  const vposMessage = findElement(xml, "VPosMessage") ?? "";
  const topLevel = xml.replace(/<VPosMessage[\s\S]*?<\/VPosMessage>/, "");
  const maskedCard = readXmlValue(vposMessage, "CardNumber") ?? "";

  return {
    responseCode: readXmlValue(topLevel, "ResponseCode") ?? "",
    responseMessage: readXmlValue(topLevel, "ResponseMessage") ?? "",
    merchantOrderId:
      readXmlValue(topLevel, "MerchantOrderId") || readXmlValue(vposMessage, "MerchantOrderId") || "",
    orderId: readXmlValue(topLevel, "OrderId") ?? "",
    provisionNumber: readXmlValue(topLevel, "ProvisionNumber") ?? "",
    rrn: readXmlValue(topLevel, "RRN") ?? "",
    stan: readXmlValue(topLevel, "Stan") ?? "",
    amountKurus: parseKurus(readXmlValue(vposMessage, "Amount")),
    currencyCode: readXmlValue(vposMessage, "CurrencyCode") || undefined,
    cardLast4: /\d{4}$/.exec(maskedCard)?.[0],
    hashData: readXmlValue(topLevel, "HashData") || undefined,
  };
}

// ---------------------------------------------------------------------------
// İptal / iade (WCF VirtualPosService, SOAP 1.1)
// ---------------------------------------------------------------------------

export type KuveytTurkReversalOperation = "SaleReversal" | "DrawBack" | "PartialDrawback";

export interface ReversalInput {
  operation: KuveytTurkReversalOperation;
  merchantOrderId: string;
  /** Bank OrderId from the provision response. */
  orderId: string;
  rrn: string;
  stan: string;
  provisionNumber: string;
  /** Kuruş: full amount for SaleReversal/DrawBack, the refunded part for PartialDrawback. */
  amountKurus: number;
}

/** SOAP envelope; element order follows the bank's WCF data contract. */
export function buildReversalSoapEnvelope(credentials: KuveytTurkCredentials, input: ReversalInput) {
  const hashData = buildProvisionHash(credentials, {
    merchantOrderId: input.merchantOrderId,
    amountKurus: input.amountKurus,
  });

  const vposMessage: XmlTree = [
    ["MerchantId", credentials.merchantId],
    ["CustomerId", credentials.customerId],
    ["UserName", credentials.username],
    ["APIVersion", KUVEYTTURK_API_VERSION],
    ["InstallmentMaturityCommisionFlag", 0],
    ["HashData", hashData],
    ["SubMerchantId", 0],
    ["CardType", "Visa"],
    ["BatchID", 0],
    ["TransactionType", input.operation],
    ["InstallmentCount", 0],
    ["Amount", input.amountKurus],
    ["DisplayAmount", input.operation === "SaleReversal" ? input.amountKurus : 0],
    ["CancelAmount", input.amountKurus],
    ["MerchantOrderId", input.merchantOrderId],
    ["FECAmount", 0],
    ["CurrencyCode", KUVEYTTURK_CURRENCY_TRY],
    ["QeryId", 0],
    ["DebtId", 0],
    ["SurchargeAmount", 0],
    ["SGKDebtAmount", 0],
    ["TransactionSecurity", 1],
  ];

  const request: XmlTree = [
    ["IsFromExternalNetwork", true],
    ["BusinessKey", 0],
    ["ResourceId", 0],
    ["ActionId", 0],
    ["LanguageId", 0],
    ["CustomerId", credentials.customerId],
    ["MailOrTelephoneOrder", true],
    ["Amount", input.amountKurus],
    ["MerchantId", credentials.merchantId],
    ["OrderId", input.orderId],
    ["RRN", input.rrn],
    ["Stan", input.stan],
    ["ProvisionNumber", input.provisionNumber],
    ["VPosMessage", vposMessage],
  ];

  const body = renderXml([[input.operation, [["request", request]]]], "ser:");

  return {
    soapAction: `${SOAP_ACTION_PREFIX}${input.operation}`,
    body: `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="${SOAP_SERVICE_NAMESPACE}"><soapenv:Body>${body}</soapenv:Body></soapenv:Envelope>`,
  };
}

export interface ReversalResponse {
  ok: boolean;
  responseCode: string;
  message: string;
  orderId?: string;
  rrn?: string;
  stan?: string;
  provisionNumber?: string;
}

export function parseReversalResponse(
  xml: string,
  operation: KuveytTurkReversalOperation
): ReversalResponse {
  const fault = readXmlValue(xml, "Fault/faultstring");
  if (fault !== undefined) {
    return { ok: false, responseCode: "SOAP_FAULT", message: fault };
  }

  const result = findElement(xml, `${operation}Result`) ?? "";
  const value = findElement(result, "Value") ?? "";
  const responseCode = readXmlValue(value, "ResponseCode") ?? "";
  const errorMessage = readXmlValue(result, "Results/Result/ErrorMessage");

  return {
    ok: responseCode === KUVEYTTURK_SUCCESS_CODE,
    responseCode,
    message: readXmlValue(value, "ResponseMessage") || errorMessage || "",
    orderId: readXmlValue(value, "OrderId") || undefined,
    rrn: readXmlValue(value, "RRN") || undefined,
    stan: readXmlValue(value, "Stan") || undefined,
    provisionNumber: readXmlValue(value, "ProvisionNumber") || undefined,
  };
}

// ---------------------------------------------------------------------------
// Customer-facing error text
// ---------------------------------------------------------------------------

const TURKISH_ERROR_MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: "3D Secure doğrulaması tamamlanmadı veya iptal edildi.",
  "888": "3D Secure doğrulaması tamamlanmadı veya iptal edildi.",
  HashDataError: "İşlem güvenlik doğrulamasından geçemedi.",
  "05": "İşlem bankanız tarafından onaylanmadı.",
  "12": "Geçersiz işlem.",
  "14": "Kart numarası geçersiz.",
  "33": "Kartın kullanım süresi dolmuş.",
  "51": "Kart limiti veya bakiyesi yetersiz.",
  "54": "Kartın son kullanma tarihi geçmiş.",
  "57": "Kartınız bu işleme kapalı.",
  "61": "Kart çekim limiti aşıldı.",
  "62": "Kart kısıtlı.",
  "82": "Güvenlik kodu (CVV) hatalı.",
  "91": "Kartı veren banka şu anda yanıt vermiyor.",
};

/**
 * The bank answers in Turkish for most declines but with bare tokens for
 * some 3-D results ("NOT_AUTHENTICATED"); show the customer Turkish text.
 */
export function toTurkishBankMessage(code: string, message: string) {
  const text = message.trim();
  const looksLikeSentence = /\s/.test(text) && /[a-zçğıöşü]/.test(text);
  if (looksLikeSentence) return text;
  return (
    TURKISH_ERROR_MESSAGES[text] ??
    TURKISH_ERROR_MESSAGES[code] ??
    `Ödeme bankanız tarafından onaylanmadı${code ? ` (kod ${code})` : ""}.`
  );
}
