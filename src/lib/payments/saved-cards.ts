/**
 * Saved cards (Faz 3.7) — docs/payments-saved-cards.md.
 *
 * Cards live at PayTR (Kart Saklama API). We store only PayTR's tokens
 * (utoken = PayTR user, ctoken = card), encrypted with ENCRYPTION_KEY, plus
 * display data (last 4, scheme, bank, expiry). Never the card number or CVV.
 *
 * Kuveyt Türk stays the default gateway for one-off payments; it offers no
 * card storage, so stored-card charges always go through PayTR.
 */
import { randomBytes } from "crypto";
import { Prisma, type SavedCard } from "@prisma/client";
import { db } from "@/lib/db";
import { getPaymentGatewayConfig, isCardGatewayConfigured } from "@/lib/integrations/payment-gateways/config";
import type { PaymentGatewayConfig } from "@/lib/integrations/payment-gateways/config";
import { buildGatewayNotes } from "@/lib/integrations/payment-gateways/gateway-meta";
import { refundPaytrPayment } from "@/lib/integrations/payment-gateways/providers/paytr";
import {
  buildPaytrStoreCardFields,
  chargePaytrStoredCard,
  deletePaytrCard,
  isPaytrTestMode,
  listPaytrCards,
  type PaytrBuyer,
  type StoredChargeResult,
} from "@/lib/integrations/payment-gateways/providers/paytr-card-storage";
import { getSettingMap, isEnabled } from "@/lib/integrations/settings";
import { createLogger } from "@/lib/logger";
import { max, sub, toFixed2, toKurus, toNumber } from "@/lib/money";
import { fulfillGatewayReference } from "@/lib/payments/gateway-fulfillment";
import { decryptSecret, encryptSecret } from "@/lib/secrets/crypto";
import { getAppBaseUrl } from "@/lib/stripe";

const log = createLogger("payments.saved-cards");

export const SAVED_CARD_GATEWAY = "paytr";
/** 3D verification sale on "Kart ekle"; refunded right after the card is stored. */
export const CARD_VERIFICATION_AMOUNT = "1.00";
export const MAX_ACTIVE_CARDS = 5;
/** A "Kart ekle" session older than this can't be posted any more. */
const VERIFICATION_TTL_MS = 30 * 60 * 1000;
const MAX_PENDING_PER_HOUR = 5;

export const SAVED_CARDS_PATH = "/musteri/panel/kayitli-kartlar";

/**
 * Consent shown next to the "Kart ekle" checkbox and stored verbatim with
 * the card. Changing the wording only affects new cards.
 */
export const SAVED_CARD_CONSENT_TEXT =
  "Kart bilgilerimin KLEACORE adına ödeme kuruluşu PayTR tarafından saklanmasını; kartımın doğrulanması için " +
  "1,00 TL'lik bir çekim yapılıp hemen iade edilmesini ve bu kartın, otomatik ödeme açık olduğu sürece " +
  "vadesi gelen faturalarımın tahsilatında 3D Secure doğrulaması olmadan kullanılmasını kabul ediyorum. " +
  "Kartı veya otomatik ödemeyi istediğim zaman Kayıtlı kartlarım sayfasından kaldırabilirim.";

export const AUTO_PAY_CONSENT_TEXT =
  "Vadesi gelen ve gecikmiş faturalarımın varsayılan kayıtlı kartımdan otomatik olarak tahsil edilmesini kabul ediyorum.";

export const SAVED_CARD_SETTING_KEYS = {
  enabled: "saved_cards_enabled",
  maxAttempts: "auto_charge_max_attempts",
  graceDays: "auto_charge_grace_days",
} as const;

export interface SavedCardSettings {
  enabled: boolean;
  maxAttempts: number;
  graceDays: number;
}

function clampInt(value: string, fallback: number, min: number, maxValue: number) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maxValue, Math.max(min, parsed));
}

export async function getSavedCardSettings(): Promise<SavedCardSettings> {
  const settings = await getSettingMap([
    { key: SAVED_CARD_SETTING_KEYS.enabled, env: "SAVED_CARDS_ENABLED", fallback: "false" },
    { key: SAVED_CARD_SETTING_KEYS.maxAttempts, env: "AUTO_CHARGE_MAX_ATTEMPTS", fallback: "3" },
    { key: SAVED_CARD_SETTING_KEYS.graceDays, env: "AUTO_CHARGE_GRACE_DAYS", fallback: "3" },
  ]);
  return {
    enabled: isEnabled(settings[SAVED_CARD_SETTING_KEYS.enabled]),
    maxAttempts: clampInt(settings[SAVED_CARD_SETTING_KEYS.maxAttempts], 3, 1, 10),
    graceDays: clampInt(settings[SAVED_CARD_SETTING_KEYS.graceDays], 3, 0, 30),
  };
}

export type SavedCardAvailability =
  | { available: true; config: PaymentGatewayConfig; settings: SavedCardSettings }
  | { available: false; reason: "disabled" | "gateway-not-configured"; settings: SavedCardSettings };

/** Saved cards are offered when the owner switched them on and PayTR credentials exist. */
export async function getSavedCardAvailability(): Promise<SavedCardAvailability> {
  const [settings, config] = await Promise.all([getSavedCardSettings(), getPaymentGatewayConfig()]);
  if (!settings.enabled) return { available: false, reason: "disabled", settings };
  if (!isCardGatewayConfigured(config, "paytr")) {
    return { available: false, reason: "gateway-not-configured", settings };
  }
  return { available: true, config, settings };
}

export class SavedCardError extends Error {
  constructor(
    readonly code:
      | "UNAVAILABLE"
      | "CONSENT_REQUIRED"
      | "TOO_MANY_CARDS"
      | "RATE_LIMITED"
      | "NOT_FOUND"
      | "NOT_ACTIVE"
      | "GATEWAY_ERROR"
      | "NO_DEFAULT_CARD"
      | "CVV_REQUIRED",
    message: string
  ) {
    super(message);
    this.name = "SavedCardError";
  }
}

const BRAND_LABELS: Record<string, string> = {
  VISA: "Visa",
  MASTERCARD: "Mastercard",
  TROY: "Troy",
  AMEX: "American Express",
};

export function savedCardLabel(card: Pick<SavedCard, "brand" | "last4">) {
  const brand = BRAND_LABELS[card.brand.toUpperCase()] ?? (card.brand || "Kart");
  return `${brand} •••• ${card.last4 || "????"}`;
}

/** Last moment the card can be used: end of its expiry month (UTC). */
export function cardExpiresAt(card: Pick<SavedCard, "expMonth" | "expYear">) {
  if (!card.expMonth || !card.expYear) return null;
  return new Date(Date.UTC(card.expYear, card.expMonth, 1) - 1);
}

export function isCardExpired(card: Pick<SavedCard, "expMonth" | "expYear">, now = new Date()) {
  const expiresAt = cardExpiresAt(card);
  return expiresAt !== null && expiresAt.getTime() < now.getTime();
}

function createGatewayOrderId(prefix: "KV" | "KA" | "KM") {
  // PayTR merchant_oid: alphanumeric, ≤64; unguessable.
  return `${prefix}${Date.now()}${randomBytes(6).toString("hex")}`;
}

function normalizeIp(ip: string | null | undefined) {
  const value = ip?.trim();
  if (!value || value === "::1") return "127.0.0.1";
  return value.replace(/^::ffff:/, "").slice(0, 39);
}

async function loadBuyer(userId: string, ip: string | null | undefined): Promise<PaytrBuyer> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, name: true, surname: true, address: true, city: true, phone: true },
  });
  return {
    email: user.email,
    name: `${user.name} ${user.surname}`.trim(),
    address: [user.address, user.city].filter(Boolean).join(", "),
    phone: user.phone ?? "",
    ip: normalizeIp(ip),
  };
}

function paytrCredentials(config: PaymentGatewayConfig) {
  return config.paytr;
}

// ---------------------------------------------------------------------------
// Customer view
// ---------------------------------------------------------------------------

export interface SavedCardView {
  id: string;
  label: string;
  brand: string;
  last4: string;
  expMonth: number | null;
  expYear: number | null;
  bankName: string | null;
  isDefault: boolean;
  status: SavedCard["status"];
  requireCvv: boolean;
  expiringSoon: boolean;
  createdAt: string;
}

const EXPIRY_NOTICE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export function toSavedCardView(card: SavedCard, now = new Date()): SavedCardView {
  const expiresAt = cardExpiresAt(card);
  return {
    id: card.id,
    label: savedCardLabel(card),
    brand: card.brand,
    last4: card.last4,
    expMonth: card.expMonth,
    expYear: card.expYear,
    bankName: card.bankName,
    isDefault: card.isDefault,
    status: card.status,
    requireCvv: card.requireCvv,
    expiringSoon:
      expiresAt !== null &&
      expiresAt.getTime() >= now.getTime() &&
      expiresAt.getTime() - now.getTime() <= EXPIRY_NOTICE_DAYS * DAY_MS,
    createdAt: card.createdAt.toISOString(),
  };
}

/** Cards the customer can see and use (ACTIVE + EXPIRED, newest first). */
export async function listCustomerSavedCards(userId: string) {
  const cards = await db.savedCard.findMany({
    where: { userId, status: { in: ["ACTIVE", "EXPIRED"] } },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  return cards.map((card) => toSavedCardView(card));
}

/** Pay-with-saved-card candidates: active, not expired, chargeable without CVV. */
export async function listChargeableCards(userId: string) {
  const now = new Date();
  const cards = await db.savedCard.findMany({
    where: { userId, status: "ACTIVE", requireCvv: false },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  return cards.filter((card) => !isCardExpired(card, now)).map((card) => toSavedCardView(card, now));
}

// ---------------------------------------------------------------------------
// Adding a card (PayTR store_card flow)
// ---------------------------------------------------------------------------

async function existingUtoken(userId: string) {
  const card = await db.savedCard.findFirst({
    where: { userId, gateway: SAVED_CARD_GATEWAY, gatewayCustomerRef: { not: "" } },
    orderBy: { createdAt: "desc" },
    select: { gatewayCustomerRef: true },
  });
  return card ? decryptSecret(card.gatewayCustomerRef) : null;
}

/**
 * Records the customer's consent and opens a verification session. The
 * returned ref identifies the card form (/kayitli-kartlar/ekle?ref=…).
 */
export async function startCardVerification(input: {
  userId: string;
  consent: boolean;
  ip?: string | null;
  userAgent?: string | null;
  now?: Date;
}) {
  if (input.consent !== true) {
    throw new SavedCardError("CONSENT_REQUIRED", "Kartı kaydetmek için onay metnini kabul etmelisiniz.");
  }
  const availability = await getSavedCardAvailability();
  if (!availability.available) {
    throw new SavedCardError("UNAVAILABLE", "Kart kaydetme şu anda kullanılamıyor.");
  }
  const now = input.now ?? new Date();

  const [activeCount, recentPending] = await Promise.all([
    db.savedCard.count({ where: { userId: input.userId, status: "ACTIVE" } }),
    db.savedCard.count({
      where: { userId: input.userId, status: { in: ["PENDING", "FAILED"] }, createdAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) } },
    }),
  ]);
  if (activeCount >= MAX_ACTIVE_CARDS) {
    throw new SavedCardError("TOO_MANY_CARDS", `En fazla ${MAX_ACTIVE_CARDS} kart kaydedebilirsiniz.`);
  }
  if (recentPending >= MAX_PENDING_PER_HOUR) {
    throw new SavedCardError("RATE_LIMITED", "Çok fazla deneme yapıldı. Lütfen bir saat sonra tekrar deneyin.");
  }

  const ref = createGatewayOrderId("KV");
  const card = await db.savedCard.create({
    data: {
      userId: input.userId,
      gateway: SAVED_CARD_GATEWAY,
      status: "PENDING",
      consentAt: now,
      consentIp: input.ip ?? null,
      consentUserAgent: input.userAgent?.slice(0, 512) ?? null,
      consentText: SAVED_CARD_CONSENT_TEXT,
      verificationRef: ref,
    },
    select: { id: true },
  });
  return { cardId: card.id, ref };
}

export interface CardFormSession {
  action: string;
  fields: Record<string, string>;
  amountLabel: string;
}

/** Hidden fields for the card form; null when the session isn't usable. */
export async function loadCardVerificationForm(userId: string, ref: string, ip?: string | null, now = new Date()) {
  const card = await db.savedCard.findUnique({ where: { verificationRef: ref } });
  if (!card || card.userId !== userId || card.status !== "PENDING") return null;
  if (now.getTime() - card.createdAt.getTime() > VERIFICATION_TTL_MS) return null;

  const availability = await getSavedCardAvailability();
  if (!availability.available) return null;

  const buyer = await loadBuyer(userId, ip ?? card.consentIp);
  const base = getAppBaseUrl();
  const fields = buildPaytrStoreCardFields(paytrCredentials(availability.config), {
    merchantOid: ref,
    amount: CARD_VERIFICATION_AMOUNT,
    buyer,
    okUrl: `${base}${SAVED_CARDS_PATH}?kart=dogrulaniyor`,
    failUrl: `${base}${SAVED_CARDS_PATH}?kart=basarisiz`,
    utoken: await existingUtoken(userId),
    testMode: isPaytrTestMode(),
  });
  return { action: "https://www.paytr.com/odeme", fields, amountLabel: "1,00 TL" } satisfies CardFormSession;
}

export function isCardVerificationRef(merchantOid: string) {
  return merchantOid.startsWith("KV");
}

/** PayTR notification amounts are kuruş integers ("100"); tolerate "1.00". */
function notificationAmountKurus(value: string) {
  if (/^\d+$/.test(value)) return Number(value);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : Number.NaN;
}

/**
 * PayTR notification for a "Kart ekle" verification (hash already checked).
 * Success: the card is read back with CAPI LIST, stored ACTIVE and the 1 TL
 * is refunded. Idempotent — repeated notifications find the card settled.
 */
export async function handleCardVerificationNotification(input: {
  merchantOid: string;
  status: string;
  totalAmount: string;
  utoken?: string | null;
  failedReason?: string | null;
}) {
  const card = await db.savedCard.findUnique({ where: { verificationRef: input.merchantOid } });
  if (!card) {
    log.warn("card verification notification for unknown ref", { merchantOid: input.merchantOid });
    return { handled: false as const };
  }
  if (card.status !== "PENDING") return { handled: true as const, status: card.status };

  if (input.status !== "success") {
    await db.savedCard.updateMany({
      where: { id: card.id, status: "PENDING" },
      data: { status: "FAILED", failureReason: (input.failedReason || "Kart doğrulanamadı").slice(0, 200) },
    });
    return { handled: true as const, status: "FAILED" as const };
  }

  const config = await getPaymentGatewayConfig();
  const credentials = paytrCredentials(config);
  // From here on 1 TL was charged and must be refunded whatever happens next.
  await db.savedCard.update({ where: { id: card.id }, data: { verificationChargedAt: new Date() } });

  if (notificationAmountKurus(input.totalAmount) < toKurus(CARD_VERIFICATION_AMOUNT)) {
    log.error("card verification amount mismatch", { cardId: card.id, totalAmount: input.totalAmount });
  }

  const utoken = input.utoken?.trim() || (await existingUtoken(card.userId));
  if (!utoken) {
    await markVerificationFailed(card.id, "PayTR kullanıcı anahtarı dönmedi");
    await refundVerification(config, card.id, input.merchantOid);
    return { handled: true as const, status: "FAILED" as const };
  }

  const listed = await listPaytrCards(credentials, utoken);
  if (!listed.ok) {
    // Without the card list we can't know the ctoken: fail the card (the
    // customer adds it again) and give the 1 TL back.
    log.error("card verification: CAPI LIST failed", { cardId: card.id, message: listed.message });
    await markVerificationFailed(card.id, listed.message);
    await refundVerification(config, card.id, input.merchantOid);
    return { handled: true as const, status: "FAILED" as const };
  }

  const known = await db.savedCard.findMany({
    where: { userId: card.userId, status: { in: ["ACTIVE", "EXPIRED"] } },
    select: { cardToken: true },
  });
  const knownTokens = new Set(known.map((row) => decryptSecret(row.cardToken)));
  const fresh = listed.value.filter((candidate) => !knownTokens.has(candidate.ctoken));
  // PayTR lists cards oldest first; the one just stored is the last new one.
  const stored = fresh.at(-1);
  if (!stored) {
    await markVerificationFailed(card.id, "Kart PayTR'de bulunamadı (zaten kayıtlı olabilir)");
    await refundVerification(config, card.id, input.merchantOid);
    return { handled: true as const, status: "FAILED" as const };
  }

  await db.$transaction(async (tx) => {
    const hasDefault = await tx.savedCard.count({ where: { userId: card.userId, status: "ACTIVE", isDefault: true } });
    await tx.savedCard.update({
      where: { id: card.id },
      data: {
        status: "ACTIVE",
        gatewayCustomerRef: encryptSecret(utoken),
        cardToken: encryptSecret(stored.ctoken),
        last4: stored.last4,
        brand: stored.brand,
        cardProgram: stored.program,
        expMonth: stored.expMonth,
        expYear: stored.expYear,
        bankName: stored.bankName,
        requireCvv: stored.requireCvv,
        isDefault: hasDefault === 0,
        failureReason: null,
      },
    });
  });

  await refundVerification(config, card.id, input.merchantOid);
  return { handled: true as const, status: "ACTIVE" as const };
}

async function markVerificationFailed(cardId: string, reason: string) {
  await db.savedCard.updateMany({
    where: { id: cardId, status: "PENDING" },
    data: { status: "FAILED", failureReason: reason.slice(0, 200) },
  });
}

async function refundVerification(config: PaymentGatewayConfig, cardId: string, merchantOid: string) {
  const result = await refundPaytrPayment(config, {
    merchantOid,
    amount: CARD_VERIFICATION_AMOUNT,
    referenceNo: `KVR${merchantOid}`,
  });
  if (result.ok) {
    await db.savedCard.update({ where: { id: cardId }, data: { verificationRefundedAt: new Date() } });
  } else {
    // 1 TL stays charged: visible on the card row for the admin to refund.
    log.error("card verification refund failed", { cardId, message: result.message, uncertain: result.uncertain });
  }
  return result.ok;
}

// ---------------------------------------------------------------------------
// Default / delete / auto-pay
// ---------------------------------------------------------------------------

async function findOwnedCard(userId: string, cardId: string) {
  const card = await db.savedCard.findUnique({ where: { id: cardId } });
  if (!card || card.userId !== userId || card.status === "DELETED") {
    throw new SavedCardError("NOT_FOUND", "Kart bulunamadı.");
  }
  return card;
}

export async function setDefaultSavedCard(userId: string, cardId: string) {
  const card = await findOwnedCard(userId, cardId);
  if (card.status !== "ACTIVE" || isCardExpired(card)) {
    throw new SavedCardError("NOT_ACTIVE", "Yalnızca geçerli bir kart varsayılan yapılabilir.");
  }
  await db.$transaction([
    db.savedCard.updateMany({ where: { userId, isDefault: true, NOT: { id: cardId } }, data: { isDefault: false } }),
    db.savedCard.update({ where: { id: cardId }, data: { isDefault: true } }),
  ]);
}

/**
 * Makes the newest usable card the default when the default went away;
 * without any usable card auto-pay is switched off.
 */
export async function promoteNextDefault(tx: Prisma.TransactionClient, userId: string) {
  const hasDefault = await tx.savedCard.count({ where: { userId, status: "ACTIVE", isDefault: true } });
  if (hasDefault > 0) return;
  const next = await tx.savedCard.findFirst({
    where: { userId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (next) {
    await tx.savedCard.update({ where: { id: next.id }, data: { isDefault: true } });
  } else {
    await tx.user.update({ where: { id: userId }, data: { autoPayEnabled: false } });
  }
}

/**
 * Deletes the card at PayTR first; locally it is removed (tokens wiped) only
 * when PayTR confirms or says the card is already gone, so a card we "forgot"
 * can never stay chargeable at the gateway.
 */
export async function deleteSavedCard(userId: string, cardId: string) {
  const card = await findOwnedCard(userId, cardId);

  if (card.cardToken && card.gatewayCustomerRef) {
    const config = await getPaymentGatewayConfig();
    const result = await deletePaytrCard(paytrCredentials(config), {
      utoken: decryptSecret(card.gatewayCustomerRef),
      ctoken: decryptSecret(card.cardToken),
    });
    if (!result.ok) {
      log.warn("saved card delete refused by gateway", { cardId, message: result.message });
      throw new SavedCardError("GATEWAY_ERROR", "Kart ödeme kuruluşunda silinemedi. Lütfen daha sonra tekrar deneyin.");
    }
  }

  await db.$transaction(async (tx) => {
    await tx.savedCard.update({
      where: { id: card.id },
      data: {
        status: "DELETED",
        isDefault: false,
        cardToken: "",
        gatewayCustomerRef: "",
        deletedAt: new Date(),
      },
    });
    await promoteNextDefault(tx, userId);
  });
}

export async function setAutoPay(input: { userId: string; enabled: boolean; consent?: boolean; ip?: string | null; now?: Date }) {
  if (!input.enabled) {
    await db.user.update({ where: { id: input.userId }, data: { autoPayEnabled: false } });
    return;
  }
  if (input.consent !== true) {
    throw new SavedCardError("CONSENT_REQUIRED", "Otomatik ödemeyi açmak için onay vermelisiniz.");
  }
  const availability = await getSavedCardAvailability();
  if (!availability.available) {
    throw new SavedCardError("UNAVAILABLE", "Otomatik ödeme şu anda kullanılamıyor.");
  }
  const card = await db.savedCard.findFirst({ where: { userId: input.userId, status: "ACTIVE", isDefault: true } });
  if (!card || isCardExpired(card)) {
    throw new SavedCardError("NO_DEFAULT_CARD", "Önce geçerli bir kart ekleyip varsayılan yapın.");
  }
  if (card.requireCvv) {
    throw new SavedCardError("CVV_REQUIRED", "Bu kart her ödemede güvenlik kodu istediği için otomatik ödemede kullanılamaz.");
  }
  await db.user.update({
    where: { id: input.userId },
    data: { autoPayEnabled: true, autoPayConsentAt: input.now ?? new Date(), autoPayConsentIp: input.ip ?? null },
  });
}

// ---------------------------------------------------------------------------
// Charging a stored card for an invoice
// ---------------------------------------------------------------------------

export type ChargeInvoiceResult =
  | { status: "succeeded"; attemptId: string; amount: number }
  | { status: "failed"; attemptId: string; amount: number; message: string; code?: string }
  | { status: "pending"; attemptId: string; amount: number; message: string }
  | { status: "duplicate" }
  | { status: "skipped"; reason: string };

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

const ATTEMPT_NOTES: Record<"AUTO" | "MANUAL", string> = {
  AUTO: "PayTR kayıtlı kart (otomatik tahsilat)",
  MANUAL: "PayTR kayıtlı kart ödemesi",
};

/**
 * Charges one invoice's outstanding amount from a stored card (PayTR
 * non-3D, recurring). `idempotencyKey` is unique: a second call with the
 * same key returns "duplicate" without touching the gateway.
 *
 * The amount is always re-read from the invoice (never from the caller), the
 * PENDING Payment row carries exactly that amount, and success goes through
 * the regular fulfilment (fulfillGatewayReference → fulfillInvoicePayment),
 * which is idempotent with PayTR's own notification for the same order.
 */
export async function chargeInvoiceWithSavedCard(input: {
  invoiceId: string;
  cardId: string;
  kind: "AUTO" | "MANUAL";
  idempotencyKey: string;
  ip?: string | null;
}): Promise<ChargeInvoiceResult> {
  const availability = await getSavedCardAvailability();
  if (!availability.available) return { status: "skipped", reason: availability.reason };

  const card = await db.savedCard.findUnique({ where: { id: input.cardId } });
  if (!card || card.status !== "ACTIVE" || !card.cardToken || !card.gatewayCustomerRef) {
    return { status: "skipped", reason: "card-not-active" };
  }
  if (isCardExpired(card)) return { status: "skipped", reason: "card-expired" };
  if (card.requireCvv) return { status: "skipped", reason: "cvv-required" };

  const merchantOid = createGatewayOrderId(input.kind === "AUTO" ? "KA" : "KM");
  let prepared: { attemptId: string; amount: string; invoiceNumber: string; customerId: string; notes: string };
  try {
    const outcome = await db.$transaction(async (tx) => {
      // Serialises charges of one invoice: the checks below see every attempt
      // committed before us, so two clicks / runs can't both charge.
      await tx.$queryRaw`SELECT id FROM invoices WHERE id = ${input.invoiceId} FOR UPDATE`;
      const invoice = await tx.invoice.findUnique({
        where: { id: input.invoiceId },
        select: { id: true, invoiceNumber: true, customerId: true, status: true, totalAmount: true, paidAmount: true },
      });
      if (!invoice || invoice.customerId !== card.userId) return { kind: "skipped", reason: "invoice-not-found" } as const;
      if (invoice.status !== "PENDING" && invoice.status !== "OVERDUE") return { kind: "skipped", reason: "invoice-not-payable" } as const;

      // Amount comes from the invoice, never from the caller.
      const outstanding = max(0, sub(invoice.totalAmount, invoice.paidAmount));
      if (toKurus(outstanding) <= 0) return { kind: "skipped", reason: "nothing-due" } as const;

      // A charge whose outcome is still open blocks new ones for this invoice.
      const inFlight = await tx.paymentAttempt.count({
        where: { invoiceId: invoice.id, status: { in: ["PENDING", "UNKNOWN"] } },
      });
      if (inFlight > 0) return { kind: "duplicate" } as const;

      const amount = toFixed2(outstanding);
      const notes = buildGatewayNotes(ATTEMPT_NOTES[input.kind], {
        invoiceIds: [invoice.id],
        customerId: invoice.customerId,
        context: "panel_invoice",
        provider: "paytr",
      });
      const attempt = await tx.paymentAttempt.create({
        data: {
          idempotencyKey: input.idempotencyKey,
          kind: input.kind,
          invoiceId: invoice.id,
          userId: invoice.customerId,
          savedCardId: card.id,
          gateway: SAVED_CARD_GATEWAY,
          gatewayRef: merchantOid,
          amount,
          status: "PENDING",
        },
        select: { id: true },
      });
      // Our own PENDING row for this order, with exactly the amount we charge.
      await tx.payment.create({
        data: {
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          amount,
          method: "CREDIT_CARD",
          status: "PENDING",
          transactionId: merchantOid,
          notes,
        },
      });
      return {
        kind: "prepared",
        prepared: { attemptId: attempt.id, amount, invoiceNumber: invoice.invoiceNumber, customerId: invoice.customerId, notes },
      } as const;
    });
    if (outcome.kind === "skipped") return { status: "skipped", reason: outcome.reason };
    if (outcome.kind === "duplicate") return { status: "duplicate" };
    prepared = outcome.prepared;
  } catch (error) {
    if (isUniqueViolation(error)) return { status: "duplicate" };
    throw error;
  }
  const { attemptId, amount, notes } = prepared;
  const invoice = { id: input.invoiceId, invoiceNumber: prepared.invoiceNumber, customerId: prepared.customerId };

  const buyer = await loadBuyer(invoice.customerId, input.ip ?? card.consentIp);
  const base = getAppBaseUrl();
  let charge: StoredChargeResult;
  try {
    charge = await chargePaytrStoredCard(paytrCredentials(availability.config), {
      merchantOid,
      amount,
      description: `Fatura ${invoice.invoiceNumber}`,
      buyer,
      utoken: decryptSecret(card.gatewayCustomerRef),
      ctoken: decryptSecret(card.cardToken),
      okUrl: `${base}/musteri/panel/faturalar/${invoice.id}?payment=success`,
      failUrl: `${base}/musteri/panel/faturalar/${invoice.id}?payment=failed`,
      testMode: isPaytrTestMode(),
    });
  } catch (error) {
    log.error("stored card charge threw", { attemptId, invoiceId: invoice.id, error });
    charge = { outcome: "unknown", message: "Ödeme kuruluşu yanıtı alınamadı." };
  }

  if (charge.outcome === "success") {
    const fulfilment = await fulfillGatewayReference(merchantOid, notes, { requestedAmount: toNumber(amount) });
    await db.paymentAttempt.update({
      where: { id: attemptId },
      data: { status: "SUCCEEDED", finishedAt: new Date(), errorMessage: fulfilment.amountMismatch ? "AMOUNT_MISMATCH" : null },
    });
    return { status: "succeeded", attemptId, amount: toNumber(amount) };
  }

  if (charge.outcome === "failed") {
    await recordFailedCharge(attemptId, merchantOid, charge.message, charge.code);
    return { status: "failed", attemptId, amount: toNumber(amount), message: charge.message, code: charge.code };
  }

  // pending / unknown: PayTR's notification settles it (see settleStoredChargeNotification).
  await db.paymentAttempt.updateMany({
    where: { id: attemptId, status: "PENDING" },
    data: { status: "UNKNOWN", errorMessage: charge.message.slice(0, 200) },
  });
  return { status: "pending", attemptId, amount: toNumber(amount), message: charge.message };
}

async function recordFailedCharge(attemptId: string, merchantOid: string, message: string, code?: string) {
  await db.$transaction([
    db.payment.updateMany({
      where: { transactionId: merchantOid, status: "PENDING" },
      data: { status: "FAILED", notes: `Kayıtlı kart çekimi reddedildi: ${message}`.slice(0, 500) },
    }),
    db.paymentAttempt.updateMany({
      where: { id: attemptId, status: { in: ["PENDING", "UNKNOWN"] } },
      data: { status: "FAILED", finishedAt: new Date(), errorMessage: message.slice(0, 200), errorCode: code ?? null },
    }),
  ]);
}

/**
 * Called by the PayTR notification route for stored-card orders after the
 * regular fulfilment ran: closes the PaymentAttempt. Returns the attempt
 * when the notification turned it into a failure (so the caller can notify).
 */
export async function settleStoredChargeNotification(input: { merchantOid: string; status: string; failedReason?: string | null }) {
  const attempt = await db.paymentAttempt.findUnique({ where: { gatewayRef: input.merchantOid } });
  if (!attempt) return null;
  if (input.status === "success") {
    await db.paymentAttempt.updateMany({
      where: { id: attempt.id, status: { in: ["PENDING", "UNKNOWN", "FAILED"] } },
      data: { status: "SUCCEEDED", finishedAt: new Date() },
    });
    return null;
  }
  if (attempt.status === "PENDING" || attempt.status === "UNKNOWN") {
    await recordFailedCharge(attempt.id, input.merchantOid, input.failedReason || "Kart çekimi reddedildi", undefined);
    return db.paymentAttempt.findUnique({ where: { id: attempt.id } });
  }
  return null;
}
