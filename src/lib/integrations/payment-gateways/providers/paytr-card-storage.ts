/**
 * PayTR Kart Saklama (CAPI) + Direct API, used for saved cards and automatic
 * collection (docs/payments-saved-cards.md).
 *
 * - Storing: the customer's browser posts the card form STRAIGHT to
 *   https://www.paytr.com/odeme with `store_card=1` (3D, 1 TL verification).
 *   The card number never reaches our server; we only build the hidden fields.
 * - Listing / deleting: server-to-server with the user token (utoken).
 * - Charging: `non_3d=1` + `recurring_payment=1` with utoken + ctoken; PayTR
 *   answers synchronously with JSON and also sends the usual notification.
 *
 * utoken/ctoken are credentials for charging a customer's card: never log
 * them and never put them in error messages.
 */
import { createHmac } from "crypto";
import { toFixed2 } from "@/lib/money";
import type { PaymentGatewayConfig } from "../config";

export const PAYTR_DIRECT_URL = "https://www.paytr.com/odeme";
export const PAYTR_CAPI_LIST_URL = "https://www.paytr.com/odeme/capi/list";
export const PAYTR_CAPI_DELETE_URL = "https://www.paytr.com/odeme/capi/delete";

const REQUEST_TIMEOUT_MS = 30_000;

type PaytrCredentials = Pick<PaymentGatewayConfig["paytr"], "merchantId" | "merchantKey" | "merchantSalt">;

function hmacBase64(message: string, key: string) {
  return createHmac("sha256", key).update(message, "utf8").digest("base64");
}

export function isPaytrTestMode() {
  return process.env.PAYTR_TEST_MODE === "1";
}

/**
 * paytr_token of Direct API payments (new card, stored card, recurring):
 * HMAC-SHA256(merchant_id + user_ip + merchant_oid + email + payment_amount +
 * payment_type + installment_count + currency + test_mode + non_3d + salt).
 */
export function buildPaytrDirectToken(
  credentials: PaytrCredentials,
  fields: {
    userIp: string;
    merchantOid: string;
    email: string;
    paymentAmount: string;
    paymentType: string;
    installmentCount: string;
    currency: string;
    testMode: string;
    non3d: string;
  }
) {
  const hashStr =
    `${credentials.merchantId}${fields.userIp}${fields.merchantOid}${fields.email}` +
    `${fields.paymentAmount}${fields.paymentType}${fields.installmentCount}${fields.currency}` +
    `${fields.testMode}${fields.non3d}${credentials.merchantSalt}`;
  return hmacBase64(hashStr, credentials.merchantKey);
}

/** CAPI LIST: HMAC-SHA256(utoken + salt). */
export function buildPaytrCapiListToken(credentials: PaytrCredentials, utoken: string) {
  return hmacBase64(`${utoken}${credentials.merchantSalt}`, credentials.merchantKey);
}

/** CAPI DELETE: HMAC-SHA256(ctoken + utoken + salt). */
export function buildPaytrCapiDeleteToken(credentials: PaytrCredentials, ctoken: string, utoken: string) {
  return hmacBase64(`${ctoken}${utoken}${credentials.merchantSalt}`, credentials.merchantKey);
}

export interface PaytrBuyer {
  email: string;
  name: string;
  address: string;
  phone: string;
  ip: string;
}

function buyerFields(buyer: PaytrBuyer) {
  return {
    user_name: buyer.name.trim().slice(0, 60) || "Müşteri",
    user_address: (buyer.address.trim() || "Türkiye").slice(0, 400),
    user_phone: (buyer.phone.trim() || "05555555555").slice(0, 20),
  };
}

/** Direct API user_basket: JSON (not base64, unlike the iFrame API). */
function directBasket(description: string, amount: string) {
  return JSON.stringify([[description.slice(0, 120), amount, 1]]);
}

/**
 * Hidden fields of the "add card" form. The browser adds cc_owner,
 * card_number, expiry_month, expiry_year and cvv and posts everything to
 * PAYTR_DIRECT_URL. A 1 TL 3D sale verifies the card; it is refunded after
 * the notification arrives.
 */
export function buildPaytrStoreCardFields(
  credentials: PaytrCredentials,
  input: {
    merchantOid: string;
    amount: number | string;
    buyer: PaytrBuyer;
    okUrl: string;
    failUrl: string;
    /** Existing utoken of the customer, so all cards share one PayTR user. */
    utoken?: string | null;
    testMode?: boolean;
  }
): Record<string, string> {
  const paymentAmount = toFixed2(input.amount);
  const common = {
    userIp: input.buyer.ip,
    merchantOid: input.merchantOid,
    email: input.buyer.email,
    paymentAmount,
    paymentType: "card",
    installmentCount: "0",
    currency: "TL",
    testMode: input.testMode ? "1" : "0",
    non3d: "0",
  };
  const fields: Record<string, string> = {
    merchant_id: credentials.merchantId,
    paytr_token: buildPaytrDirectToken(credentials, common),
    user_ip: common.userIp,
    merchant_oid: common.merchantOid,
    email: common.email,
    payment_amount: paymentAmount,
    payment_type: common.paymentType,
    installment_count: common.installmentCount,
    currency: common.currency,
    test_mode: common.testMode,
    non_3d: common.non3d,
    client_lang: "tr",
    merchant_ok_url: input.okUrl,
    merchant_fail_url: input.failUrl,
    user_basket: directBasket("Kart doğrulama (iade edilir)", paymentAmount),
    store_card: "1",
    ...buyerFields(input.buyer),
  };
  if (input.utoken) {
    fields.utoken = input.utoken;
  }
  return fields;
}

/** One card in a CAPI LIST response (display data + ctoken). */
export interface PaytrStoredCard {
  ctoken: string;
  last4: string;
  requireCvv: boolean;
  expMonth: number | null;
  expYear: number | null;
  bankName: string | null;
  /** Scheme: VISA, MASTERCARD, TROY, AMEX, OTHER. */
  brand: string;
  /** Program: bonus, world, maximum… */
  program: string | null;
}

export type PaytrCapiResult<T> = { ok: true; value: T } | { ok: false; uncertain?: boolean; message: string };

function asString(value: unknown) {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : "";
}

function parseYear(value: unknown) {
  const digits = asString(value).replace(/\D/g, "");
  if (!digits) return null;
  const year = Number(digits);
  return digits.length <= 2 ? 2000 + year : year;
}

function parseMonth(value: unknown) {
  const month = Number(asString(value).replace(/\D/g, ""));
  return month >= 1 && month <= 12 ? month : null;
}

const SCHEME_BY_INITIAL: Record<string, string> = {
  "2": "MASTERCARD",
  "3": "AMEX",
  "4": "VISA",
  "5": "MASTERCARD",
  "9": "TROY",
};

export function parsePaytrCardListResponse(text: string): PaytrCapiResult<PaytrStoredCard[]> {
  let payload: unknown;
  try {
    payload = text.trim() ? JSON.parse(text) : [];
  } catch {
    return { ok: false, message: "PayTR kart listesi okunamadı." };
  }

  if (payload && !Array.isArray(payload) && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (record.status === "error" || record.status === "failed") {
      return { ok: false, message: `PayTR kart listesi alınamadı: ${asString(record.err_msg) || "bilinmeyen hata"}` };
    }
    // An empty object means "no cards".
    if (Object.keys(record).length === 0) return { ok: true, value: [] };
  }

  const items = Array.isArray(payload) ? payload : [];
  const cards: PaytrStoredCard[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const card = item as Record<string, unknown>;
    const ctoken = asString(card.ctoken);
    if (!ctoken) continue;
    const schema = asString(card.schema).toUpperCase();
    cards.push({
      ctoken,
      last4: asString(card.last_4).replace(/\D/g, "").slice(-4),
      requireCvv: asString(card.require_cvv) === "1",
      expMonth: parseMonth(card.month),
      expYear: parseYear(card.year),
      bankName: asString(card.c_bank) || null,
      brand: schema && schema !== "OTHER" ? schema : SCHEME_BY_INITIAL[asString(card.initial)] ?? (schema || "KART"),
      program: asString(card.c_brand) || null,
    });
  }
  return { ok: true, value: cards };
}

async function postForm(url: string, body: URLSearchParams): Promise<{ ok: true; status: number; text: string } | { ok: false }> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return { ok: true, status: response.status, text: await response.text() };
  } catch {
    return { ok: false };
  }
}

export async function listPaytrCards(
  credentials: PaytrCredentials,
  utoken: string
): Promise<PaytrCapiResult<PaytrStoredCard[]>> {
  const response = await postForm(
    PAYTR_CAPI_LIST_URL,
    new URLSearchParams({
      merchant_id: credentials.merchantId,
      utoken,
      paytr_token: buildPaytrCapiListToken(credentials, utoken),
    })
  );
  if (!response.ok) return { ok: false, uncertain: true, message: "PayTR'ye ulaşılamadı." };
  if (response.status >= 400) return { ok: false, uncertain: response.status >= 500, message: `PayTR HTTP ${response.status}` };
  return parsePaytrCardListResponse(response.text);
}

/** "No such card" / "already deleted" errors: the card is gone either way. */
const CARD_GONE = /(kart\s*bulunamad|zaten\s*silin|already|not\s*found|no\s*card)/i;

export function parsePaytrCardDeleteResponse(text: string): PaytrCapiResult<{ alreadyGone: boolean }> {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { ok: false, uncertain: true, message: "PayTR yanıtı okunamadı." };
  }
  if (payload.status === "success") return { ok: true, value: { alreadyGone: false } };
  const message = asString(payload.err_msg);
  if (CARD_GONE.test(message)) return { ok: true, value: { alreadyGone: true } };
  return { ok: false, message: `PayTR kartı silmedi: ${message || "bilinmeyen hata"}` };
}

export async function deletePaytrCard(
  credentials: PaytrCredentials,
  input: { utoken: string; ctoken: string }
): Promise<PaytrCapiResult<{ alreadyGone: boolean }>> {
  const response = await postForm(
    PAYTR_CAPI_DELETE_URL,
    new URLSearchParams({
      merchant_id: credentials.merchantId,
      utoken: input.utoken,
      ctoken: input.ctoken,
      paytr_token: buildPaytrCapiDeleteToken(credentials, input.ctoken, input.utoken),
    })
  );
  if (!response.ok) return { ok: false, uncertain: true, message: "PayTR'ye ulaşılamadı." };
  if (response.status >= 400) return { ok: false, uncertain: response.status >= 500, message: `PayTR HTTP ${response.status}` };
  return parsePaytrCardDeleteResponse(response.text);
}

export interface PaytrStoredChargeInput {
  merchantOid: string;
  amount: number | string;
  description: string;
  buyer: PaytrBuyer;
  utoken: string;
  ctoken: string;
  okUrl: string;
  failUrl: string;
  testMode?: boolean;
}

export function buildPaytrStoredChargeRequest(credentials: PaytrCredentials, input: PaytrStoredChargeInput) {
  const paymentAmount = toFixed2(input.amount);
  const common = {
    userIp: input.buyer.ip,
    merchantOid: input.merchantOid,
    email: input.buyer.email,
    paymentAmount,
    paymentType: "card",
    installmentCount: "0",
    currency: "TL",
    testMode: input.testMode ? "1" : "0",
    non3d: "1",
  };
  return new URLSearchParams({
    merchant_id: credentials.merchantId,
    paytr_token: buildPaytrDirectToken(credentials, common),
    user_ip: common.userIp,
    merchant_oid: common.merchantOid,
    email: common.email,
    payment_amount: paymentAmount,
    payment_type: common.paymentType,
    installment_count: common.installmentCount,
    currency: common.currency,
    test_mode: common.testMode,
    non_3d: common.non3d,
    recurring_payment: "1",
    client_lang: "tr",
    merchant_ok_url: input.okUrl,
    merchant_fail_url: input.failUrl,
    user_basket: directBasket(input.description, paymentAmount),
    utoken: input.utoken,
    ctoken: input.ctoken,
    ...buyerFields(input.buyer),
  });
}

/**
 * success: charged. failed: declined, no money moved. pending: PayTR is still
 * checking (wait_callback) or another transaction is in progress — the
 * notification decides. unknown: no readable answer (timeout); the
 * notification decides, never retry blindly.
 */
export type StoredChargeOutcome = "success" | "failed" | "pending" | "unknown";

export interface StoredChargeResult {
  outcome: StoredChargeOutcome;
  message: string;
  /** PayTR try_again: the same charge may succeed later. */
  retryable?: boolean;
  code?: string;
}

export function parsePaytrStoredChargeResponse(text: string): StoredChargeResult {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { outcome: "unknown", message: "PayTR yanıtı okunamadı." };
  }
  const status = asString(payload.status);
  const message = asString(payload.msg) || asString(payload.reason) || asString(payload.err_msg);
  const retryable = payload.try_again === true || payload.try_again === "true";
  if (status === "success") return { outcome: "success", message: message || "Ödeme alındı." };
  if (status === "wait_callback") return { outcome: "pending", message: message || "PayTR ödemeyi kontrol ediyor." };
  if (status === "failed" || status === "error") {
    // "Ongoing transaction" — not a decline; the notification will tell.
    if (retryable) return { outcome: "pending", message: message || "Devam eden işlem var.", retryable };
    return { outcome: "failed", message: message || "Kart çekimi reddedildi.", retryable, code: asString(payload.err_no) || undefined };
  }
  return { outcome: "unknown", message: message || "PayTR beklenmeyen yanıt verdi." };
}

export async function chargePaytrStoredCard(
  credentials: PaytrCredentials,
  input: PaytrStoredChargeInput
): Promise<StoredChargeResult> {
  const response = await postForm(PAYTR_DIRECT_URL, buildPaytrStoredChargeRequest(credentials, input));
  if (!response.ok) return { outcome: "unknown", message: "PayTR'ye ulaşılamadı." };
  if (response.status >= 500) return { outcome: "unknown", message: `PayTR HTTP ${response.status}` };
  if (response.status >= 400) return { outcome: "failed", message: `PayTR HTTP ${response.status}` };
  return parsePaytrStoredChargeResponse(response.text);
}
