/**
 * Kuveyt Türk 3-D Model flow on top of the per-session Payment rows:
 * start (card → bank 3-D page) and callback (verify → provision → fulfil).
 * MerchantOrderId is the gateway session id (Payment.transactionId).
 */
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { fulfillGatewayReference, verifyGatewayAmount } from "@/lib/payments/gateway-fulfillment";
import type { ValidatedCard } from "@/lib/payments/card-validation";
import type { PaymentContext } from "@/lib/payments/context";
import { getPaymentGatewayConfig, isKuveytTurkConfigured } from "../config";
import { parseGatewayMeta } from "../gateway-meta";
import type { GatewayMeta } from "../types";
import {
  KUVEYTTURK_NOTES_PREFIX,
  getKuveytTurkCallbackUrl,
  provisionKuveytTurkPayment,
  startKuveytTurkThreeDSecure,
} from "./kuveytturk";
import {
  KUVEYTTURK_SUCCESS_CODE,
  decodeAuthenticationResponseField,
  mapKuveytTurkCurrency,
  parseAuthenticationResponse,
  toKurus,
  toTurkishBankMessage,
  verifyAuthenticationResponseHash,
} from "./kuveytturk-protocol";

const log = createLogger("payments.kuveytturk");

/** Stored in Payment.gatewayData. Bank references only — never card data. */
export interface KuveytTurkGatewayData {
  provider: "kuveytturk";
  stage: "PROVISIONING" | "PROVISIONED" | "FAILED" | "PROVISION_UNKNOWN";
  merchantOrderId: string;
  /** Kept here because notes (and their gateway meta) are rewritten on completion. */
  context?: PaymentContext;
  orderId?: string;
  provisionNumber?: string;
  rrn?: string;
  stan?: string;
  amountKurus?: number;
  cardLast4?: string;
  errorCode?: string;
  /** Turkish text shown to the customer. */
  errorMessage?: string;
  /** Raw bank text when it differs (e.g. "NOT_AUTHENTICATED"). */
  bankMessage?: string;
  updatedAt: string;
}

function metaFromGatewayData(
  payments: Array<{ invoiceId: string; customerId: string; gatewayData: Prisma.JsonValue | null }>
): GatewayMeta | null {
  const data = payments
    .map((payment) => payment.gatewayData as Partial<KuveytTurkGatewayData> | null)
    .find((value) => value?.provider === "kuveytturk");
  if (!data) return null;
  return {
    provider: "kuveytturk",
    invoiceIds: payments.map((payment) => payment.invoiceId),
    customerId: payments[0].customerId,
    context: data.context ?? "panel_invoice",
  };
}

export async function loadKuveytTurkSession(merchantOrderId: string) {
  if (!/^[A-Za-z0-9-]{6,64}$/.test(merchantOrderId)) return null;

  const payments = await db.payment.findMany({
    where: { transactionId: merchantOrderId, method: "CREDIT_CARD" },
    select: {
      id: true,
      invoiceId: true,
      customerId: true,
      amount: true,
      status: true,
      notes: true,
      gatewayData: true,
      invoice: { select: { invoiceNumber: true, status: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const meta =
    payments.map((payment) => parseGatewayMeta(payment.notes)).find((value) => value !== null) ??
    metaFromGatewayData(payments);

  if (payments.length === 0 || !meta || meta.provider !== "kuveytturk") return null;

  const amount = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);

  return {
    merchantOrderId,
    payments,
    meta,
    customerId: payments[0].customerId,
    invoiceIds: [...new Set(payments.map((payment) => payment.invoiceId))],
    amount,
    amountKurus: toKurus(amount),
  };
}

export type KuveytTurkSession = NonNullable<Awaited<ReturnType<typeof loadKuveytTurkSession>>>;

/** Whether the card form may still be submitted for this session. */
export function isKuveytTurkSessionPayable(session: KuveytTurkSession) {
  return session.payments.every(
    (payment) =>
      payment.status === "PENDING" &&
      payment.gatewayData === null &&
      payment.invoice.status !== "PAID" &&
      payment.invoice.status !== "CANCELLED"
  );
}

// ---------------------------------------------------------------------------
// Redirects
// ---------------------------------------------------------------------------

export type KuveytTurkOutcome = "success" | "failed" | "review";

export function buildKuveytTurkRedirectPath(
  context: PaymentContext | undefined,
  merchantOrderId: string,
  invoiceIds: string[],
  outcome: KuveytTurkOutcome
) {
  const ref = encodeURIComponent(merchantOrderId);

  if (context === "cart") {
    if (outcome === "success") return `/sepet/basarili?session_id=${ref}`;
    return `/sepet/iptal?invoice_ids=${invoiceIds.map(encodeURIComponent).join(",")}&ref=${ref}${
      outcome === "review" ? "&durum=inceleme" : ""
    }`;
  }

  if (context === "panel_renewal") {
    return `/musteri/panel/hizmetlerim?renewal=${outcome === "success" ? "success" : "cancelled"}`;
  }

  if (invoiceIds.length === 1) {
    return `/musteri/panel/faturalar/${encodeURIComponent(invoiceIds[0])}?payment=${outcome}`;
  }

  return `/musteri/panel/faturalar?payment=${outcome}`;
}

// ---------------------------------------------------------------------------
// State changes
// ---------------------------------------------------------------------------

function gatewayData(
  session: KuveytTurkSession,
  data: Omit<KuveytTurkGatewayData, "provider" | "merchantOrderId" | "context" | "updatedAt">
) {
  return {
    provider: "kuveytturk",
    merchantOrderId: session.merchantOrderId,
    context: session.meta.context,
    ...data,
    updatedAt: new Date().toISOString(),
  } satisfies KuveytTurkGatewayData as Prisma.InputJsonValue;
}

/** Closes the still-pending rows of an attempt with the bank's message. */
async function markAttemptFailed(
  session: KuveytTurkSession,
  errorCode: string,
  errorMessage: string,
  extra: Partial<KuveytTurkGatewayData> = {}
) {
  const message = toTurkishBankMessage(errorCode, errorMessage);
  for (const payment of session.payments) {
    if (payment.status !== "PENDING") continue;
    await db.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: {
        status: "FAILED",
        notes: `Kuveyt Türk: ${message} | ${payment.notes ?? ""}`,
        gatewayData: gatewayData(session, {
          ...extra,
          stage: "FAILED",
          errorCode,
          errorMessage: message,
          ...(errorMessage.trim() && errorMessage.trim() !== message
            ? { bankMessage: errorMessage.trim().slice(0, 200) }
            : {}),
        }),
      },
    });
  }
}

async function setGatewayData(session: KuveytTurkSession, data: Prisma.InputJsonValue) {
  await db.payment.updateMany({
    where: { transactionId: session.merchantOrderId, method: "CREDIT_CARD" },
    data: { gatewayData: data },
  });
}

/**
 * Atomically claims the attempt for provisioning so concurrent or repeated
 * callbacks provision (and charge) at most once.
 */
async function claimForProvisioning(session: KuveytTurkSession, orderId: string) {
  const claimed = await db.payment.updateMany({
    where: {
      transactionId: session.merchantOrderId,
      method: "CREDIT_CARD",
      status: "PENDING",
      gatewayData: { equals: Prisma.DbNull },
    },
    data: {
      gatewayData: gatewayData(session, { stage: "PROVISIONING", orderId }),
    },
  });
  return claimed.count > 0;
}

// ---------------------------------------------------------------------------
// Start (card form POST)
// ---------------------------------------------------------------------------

export type StartResult =
  | { ok: true; html: string }
  | { ok: false; reason: "not_found" | "not_payable" | "not_configured" | "bank_error" };

export async function beginKuveytTurkPayment(input: {
  merchantOrderId: string;
  customerId: string;
  card: ValidatedCard;
  clientIp: string;
}): Promise<StartResult> {
  const session = await loadKuveytTurkSession(input.merchantOrderId);
  if (!session || session.customerId !== input.customerId) return { ok: false, reason: "not_found" };
  if (!isKuveytTurkSessionPayable(session) || session.amountKurus <= 0) {
    return { ok: false, reason: "not_payable" };
  }

  const config = await getPaymentGatewayConfig();
  if (!config.kuveytturk.enabled || !isKuveytTurkConfigured(config)) {
    return { ok: false, reason: "not_configured" };
  }

  const customer = await db.user.findUnique({
    where: { id: session.customerId },
    select: { email: true, phone: true, city: true, address: true },
  });
  if (!customer) return { ok: false, reason: "not_found" };

  const callbackUrl = getKuveytTurkCallbackUrl();

  try {
    const html = await startKuveytTurkThreeDSecure(config, {
      merchantOrderId: session.merchantOrderId,
      amountKurus: session.amountKurus,
      okUrl: callbackUrl,
      failUrl: callbackUrl,
      card: input.card,
      clientIp: input.clientIp,
      cardHolder: customer,
    });
    log.info("3-D yönlendirmesi başlatıldı", {
      merchantOrderId: session.merchantOrderId,
      amountKurus: session.amountKurus,
    });
    return { ok: true, html };
  } catch (error) {
    // Only our own error codes (no request body) reach the log.
    log.error("3-D başlatılamadı", {
      merchantOrderId: session.merchantOrderId,
      code: error instanceof Error ? error.message : "UNKNOWN",
    });
    return { ok: false, reason: "bank_error" };
  }
}

// ---------------------------------------------------------------------------
// Callback (bank → OkUrl / FailUrl)
// ---------------------------------------------------------------------------

export interface CallbackResult {
  outcome: KuveytTurkOutcome;
  redirectPath: string;
  /** Machine-readable reason, for tests and logs. */
  reason: string;
}

export async function handleKuveytTurkCallback(rawAuthenticationResponse: string): Promise<CallbackResult> {
  const generic = (reason: string): CallbackResult => ({
    outcome: "failed",
    redirectPath: "/musteri/panel/faturalar?payment=failed",
    reason,
  });

  const auth = parseAuthenticationResponse(decodeAuthenticationResponseField(rawAuthenticationResponse));
  if (!auth || !auth.merchantOrderId) {
    log.warn("Geçersiz AuthenticationResponse");
    return generic("INVALID_RESPONSE");
  }

  const session = await loadKuveytTurkSession(auth.merchantOrderId);
  if (!session) {
    log.warn("Bilinmeyen MerchantOrderId", { merchantOrderId: auth.merchantOrderId });
    return generic("UNKNOWN_ORDER");
  }

  const redirect = (outcome: KuveytTurkOutcome, reason: string): CallbackResult => ({
    outcome,
    redirectPath: buildKuveytTurkRedirectPath(
      session.meta.context,
      session.merchantOrderId,
      session.invoiceIds,
      outcome
    ),
    reason,
  });

  const config = await getPaymentGatewayConfig();
  if (!isKuveytTurkConfigured(config)) {
    log.error("Kuveyt Türk yapılandırılmamış; callback işlenemedi", {
      merchantOrderId: session.merchantOrderId,
    });
    return redirect("review", "NOT_CONFIGURED");
  }

  if (auth.responseCode !== KUVEYTTURK_SUCCESS_CODE) {
    // FailUrl: card not authenticated. No money moved; close the attempt.
    if (session.payments.some((payment) => payment.status === "PENDING" && payment.gatewayData === null)) {
      await markAttemptFailed(session, auth.responseCode || "3D_FAILED", auth.responseMessage);
    }
    log.info("3-D doğrulama başarısız", {
      merchantOrderId: session.merchantOrderId,
      responseCode: auth.responseCode,
    });
    return redirect("failed", `AUTH_${auth.responseCode || "FAILED"}`);
  }

  if (!verifyAuthenticationResponseHash(config.kuveytturk.password, auth)) {
    // Forged or corrupted post: change nothing.
    log.warn("AuthenticationResponse HashData doğrulanamadı", {
      merchantOrderId: session.merchantOrderId,
    });
    return redirect("failed", "BAD_HASH");
  }

  // Repeated callback of an attempt that already paid: nothing to do.
  if (session.payments.some((payment) => payment.status === "COMPLETED")) {
    return redirect("success", "ALREADY_COMPLETED");
  }

  const authAmount = verifyGatewayAmount(session.amount, {
    requestedAmount: auth.amountKurus === undefined ? undefined : auth.amountKurus / 100,
    currency: mapKuveytTurkCurrency(auth.currencyCode),
  });
  if (!authAmount.ok || auth.amountKurus === undefined) {
    log.error("3-D tutarı oturumla uyuşmuyor; provizyon alınmadı", {
      merchantOrderId: session.merchantOrderId,
      reason: authAmount.ok ? "AMOUNT_MISSING" : authAmount.reason,
    });
    await markAttemptFailed(session, "AMOUNT_MISMATCH", "Ödeme tutarı doğrulanamadı; tahsilat yapılmadı.");
    return redirect("failed", "AMOUNT_MISMATCH");
  }

  if (!auth.md) {
    await markAttemptFailed(session, "MD_MISSING", "Banka doğrulama verisi eksik; tahsilat yapılmadı.");
    return redirect("failed", "MD_MISSING");
  }

  if (!(await claimForProvisioning(session, auth.orderId))) {
    // Another callback for this attempt is (or was) provisioning it.
    const fresh = await loadKuveytTurkSession(session.merchantOrderId);
    const completed = fresh?.payments.some((payment) => payment.status === "COMPLETED");
    return redirect(completed ? "success" : "review", "ALREADY_CLAIMED");
  }

  let provision;
  try {
    provision = await provisionKuveytTurkPayment(config, {
      merchantOrderId: session.merchantOrderId,
      amountKurus: session.amountKurus,
      md: auth.md,
    });
  } catch (error) {
    // Outcome unknown: the bank may have charged. Leave for admin review.
    log.error("Provizyon isteği sonuçsuz kaldı; banka panelinden kontrol edin", {
      merchantOrderId: session.merchantOrderId,
      code: error instanceof Error ? error.message : "UNKNOWN",
    });
    await setGatewayData(
      session,
      gatewayData(session, {
        stage: "PROVISION_UNKNOWN",
        orderId: auth.orderId,
        errorCode: error instanceof Error ? error.message : "UNKNOWN",
      })
    );
    return redirect("review", "PROVISION_UNKNOWN");
  }

  if (provision.responseCode !== KUVEYTTURK_SUCCESS_CODE) {
    await markAttemptFailed(session, provision.responseCode || "PROVISION_FAILED", provision.responseMessage, {
      orderId: provision.orderId || auth.orderId,
    });
    log.info("Provizyon reddedildi", {
      merchantOrderId: session.merchantOrderId,
      responseCode: provision.responseCode,
    });
    return redirect("failed", `PROVISION_${provision.responseCode || "FAILED"}`);
  }

  const references = gatewayData(session, {
    stage: "PROVISIONED",
    orderId: provision.orderId || auth.orderId,
    provisionNumber: provision.provisionNumber,
    rrn: provision.rrn,
    stan: provision.stan,
    amountKurus: provision.amountKurus ?? session.amountKurus,
    cardLast4: provision.cardLast4,
  });
  await setGatewayData(session, references);

  if (provision.merchantOrderId && provision.merchantOrderId !== session.merchantOrderId) {
    log.error("Provizyon yanıtı farklı bir siparişe ait; fatura ödenmiş sayılmadı", {
      merchantOrderId: session.merchantOrderId,
      responseMerchantOrderId: provision.merchantOrderId,
    });
    return redirect("review", "ORDER_MISMATCH");
  }

  let fulfillment;
  try {
    fulfillment = await fulfillGatewayReference(session.merchantOrderId, KUVEYTTURK_NOTES_PREFIX, {
      requestedAmount:
        provision.amountKurus === undefined ? session.amount : provision.amountKurus / 100,
      currency: mapKuveytTurkCurrency(provision.currencyCode) ?? "TRY",
    });
  } catch (error) {
    // The card IS charged (stage PROVISIONED is stored) but fulfilment
    // rolled back; the invoice must be closed by an admin. Never a 500 to
    // the customer, and never a second provision on retry.
    log.error("Tahsilat yapıldı ancak fatura kapatılamadı; yönetici müdahalesi gerekli", {
      merchantOrderId: session.merchantOrderId,
      invoiceIds: session.invoiceIds,
      error,
    });
    return redirect("review", "FULFILLMENT_ERROR");
  }

  if (fulfillment.amountMismatch) {
    return redirect("review", "PROVISION_AMOUNT_MISMATCH");
  }

  log.info("Ödeme tamamlandı", {
    merchantOrderId: session.merchantOrderId,
    invoiceIds: fulfillment.invoiceIds,
  });
  return redirect("success", fulfillment.fulfilled ? "FULFILLED" : "ALREADY_FULFILLED");
}

/** Bank error text of a failed attempt, for its owner's result page. */
export async function getKuveytTurkFailureMessage(
  where: { merchantOrderId: string } | { invoiceId: string },
  customerId: string | undefined
) {
  if (!customerId) return null;
  const payment = await db.payment.findFirst({
    where: {
      customerId,
      status: "FAILED",
      method: "CREDIT_CARD",
      ...("merchantOrderId" in where
        ? { transactionId: where.merchantOrderId }
        : { invoiceId: where.invoiceId }),
      gatewayData: { path: ["provider"], equals: "kuveytturk" },
    },
    orderBy: { createdAt: "desc" },
    select: { gatewayData: true },
  });
  const data = payment?.gatewayData as Partial<KuveytTurkGatewayData> | null | undefined;
  return typeof data?.errorMessage === "string" ? data.errorMessage : null;
}
