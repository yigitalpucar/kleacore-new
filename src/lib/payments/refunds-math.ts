/**
 * Pure refund rules: bounds, invoice status transitions, Kuveyt Türk
 * operation choice and the e-fatura decision. No DB, no network.
 */
import type { InvoiceStatus } from "@prisma/client";
import { compare, isPositive, max, roundHalfUp, sub, sum, toKurus, type MoneyInput } from "@/lib/money";
import type { Prisma } from "@prisma/client";

export const REFUNDABLE_INVOICE_STATUSES: readonly InvoiceStatus[] = ["PAID", "PARTIALLY_REFUNDED"];

/** Refund rows that hold money: completed ones and those whose outcome is not known yet. */
export const COUNTED_REFUND_STATUSES = ["PENDING", "COMPLETED"] as const;

export function isRefundableInvoiceStatus(status: string) {
  return (REFUNDABLE_INVOICE_STATUSES as readonly string[]).includes(status);
}

/** paidAmount minus every refund that is completed or still in flight, never negative. */
export function refundableAmount(
  paidAmount: MoneyInput,
  refunds: ReadonlyArray<{ amount: MoneyInput; status: string }>
): Prisma.Decimal {
  const held = sum(
    refunds
      .filter((refund) => (COUNTED_REFUND_STATUSES as readonly string[]).includes(refund.status))
      .map((refund) => refund.amount)
  );
  return max(0, sub(paidAmount, held));
}

export type RefundAmountCheck =
  | { ok: true; amount: Prisma.Decimal }
  | { ok: false; error: string };

export function validateRefundAmount(requested: MoneyInput, refundable: MoneyInput): RefundAmountCheck {
  let amount: Prisma.Decimal;
  try {
    amount = roundHalfUp(requested);
  } catch {
    return { ok: false, error: "İade tutarı geçersiz." };
  }
  if (!isPositive(amount)) {
    return { ok: false, error: "İade tutarı sıfırdan büyük olmalı." };
  }
  if (compare(amount, refundable) > 0) {
    return { ok: false, error: "İade tutarı ödenen tutardan önceki iadeler düşüldükten sonra kalan tutarı aşamaz." };
  }
  return { ok: true, amount };
}

/** Invoice status after refunds totalling `refundedTotal` of `paidAmount`. */
export function invoiceStatusAfterRefunds(paidAmount: MoneyInput, refundedTotal: MoneyInput): InvoiceStatus {
  if (!isPositive(refundedTotal)) return "PAID";
  return compare(refundedTotal, paidAmount) >= 0 ? "REFUNDED" : "PARTIALLY_REFUNDED";
}

/** Calendar day in Türkiye — the bank's end-of-day batch closes on this clock. */
export function istanbulDay(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export type KuveytTurkRefundPlan =
  | { ok: true; operation: "SaleReversal" | "DrawBack" | "PartialDrawback"; amountKurus: number }
  | { ok: false; error: string };

/**
 * Before the end-of-day batch a sale can only be reversed as a whole
 * (SaleReversal); afterwards the full amount goes back with DrawBack and any
 * part with PartialDrawback. "Full" means the whole bank session and nothing
 * of it refunded yet — a cart session pays several invoices at once.
 */
export function planKuveytTurkRefund(input: {
  paidAt: Date;
  now: Date;
  refundAmount: MoneyInput;
  sessionAmountKurus: number;
  sessionRefundedKurus: number;
}): KuveytTurkRefundPlan {
  const amountKurus = toKurus(input.refundAmount);
  const sameDay = istanbulDay(input.paidAt) === istanbulDay(input.now);
  const full = amountKurus === input.sessionAmountKurus && input.sessionRefundedKurus === 0;

  if (amountKurus + input.sessionRefundedKurus > input.sessionAmountKurus) {
    return { ok: false, error: "İade tutarı bankada çekilen tutarı aşıyor." };
  }

  if (sameDay) {
    if (!full) {
      return {
        ok: false,
        error:
          "Kuveyt Türk aynı gün içinde yalnızca işlemin tamamını iptal eder. Kısmi iadeyi gün sonundan sonra (yarın) yapın veya tutarın tamamını iade edin.",
      };
    }
    return { ok: true, operation: "SaleReversal", amountKurus };
  }

  return { ok: true, operation: full ? "DrawBack" : "PartialDrawback", amountKurus };
}

/** GİB: an e-Arşiv invoice may be cancelled within 7 days of issue; later a return invoice is needed. */
export const EARSIV_CANCEL_WINDOW_DAYS = 7;

export type EInvoiceRefundAction = "EARSIV_CANCEL" | "RETURN_INVOICE_REQUIRED" | null;

export function decideEInvoiceAction(input: {
  record: { type: string; status: string; sentAt: Date | null } | null;
  fullyRefunded: boolean;
  now: Date;
}): EInvoiceRefundAction {
  const { record } = input;
  if (!record || !["SENT", "ACCEPTED"].includes(record.status)) return null;
  if (record.type === "e-arsiv" && input.fullyRefunded && record.sentAt) {
    const ageMs = input.now.getTime() - record.sentAt.getTime();
    if (ageMs <= EARSIV_CANCEL_WINDOW_DAYS * 24 * 60 * 60 * 1000) return "EARSIV_CANCEL";
  }
  return "RETURN_INVOICE_REQUIRED";
}
