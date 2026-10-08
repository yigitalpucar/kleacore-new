import { describe, expect, it } from "vitest";
import { toNumber } from "@/lib/money";
import {
  decideEInvoiceAction,
  invoiceStatusAfterRefunds,
  planKuveytTurkRefund,
  refundableAmount,
  validateRefundAmount,
} from "./refunds-math";

describe("refund amount bounds", () => {
  it("is paid minus completed and in-flight refunds; failed ones don't count", () => {
    const refundable = refundableAmount("120.00", [
      { amount: "20.00", status: "COMPLETED" },
      { amount: "30.00", status: "PENDING" },
      { amount: "70.00", status: "FAILED" },
    ]);
    expect(toNumber(refundable)).toBe(70);
  });

  it("accepts up to the refundable amount, rejects more, zero and negatives", () => {
    expect(validateRefundAmount("70.00", "70.00")).toMatchObject({ ok: true });
    expect(validateRefundAmount("70.01", "70.00").ok).toBe(false);
    expect(validateRefundAmount(0, "70.00").ok).toBe(false);
    expect(validateRefundAmount(-5, "70.00").ok).toBe(false);
    expect(validateRefundAmount("abc", "70.00").ok).toBe(false);
  });

  it("rounds to kuruş before comparing (0.1 + 0.2 style noise never passes the bound)", () => {
    const check = validateRefundAmount(0.1 + 0.2, "0.30");
    expect(check.ok).toBe(true);
    if (check.ok) expect(check.amount.toFixed(2)).toBe("0.30");
  });

  it("partial refunds add up to exactly the paid amount", () => {
    const paid = "100.00";
    const refunds: Array<{ amount: string; status: string }> = [];
    for (const part of ["33.33", "33.33", "33.34"]) {
      const check = validateRefundAmount(part, refundableAmount(paid, refunds));
      expect(check.ok).toBe(true);
      refunds.push({ amount: part, status: "COMPLETED" });
    }
    expect(toNumber(refundableAmount(paid, refunds))).toBe(0);
    expect(validateRefundAmount("0.01", refundableAmount(paid, refunds)).ok).toBe(false);
  });
});

describe("invoice status transitions", () => {
  it("PAID → PARTIALLY_REFUNDED → REFUNDED", () => {
    expect(invoiceStatusAfterRefunds("100", "0")).toBe("PAID");
    expect(invoiceStatusAfterRefunds("100", "40")).toBe("PARTIALLY_REFUNDED");
    expect(invoiceStatusAfterRefunds("100", "100")).toBe("REFUNDED");
  });
});

describe("Kuveyt Türk operation", () => {
  const paidAt = new Date("2026-10-08T09:00:00Z"); // 12:00 in İstanbul

  it("same day, full amount → SaleReversal", () => {
    expect(
      planKuveytTurkRefund({
        paidAt,
        now: new Date("2026-10-08T18:00:00Z"),
        refundAmount: "120.00",
        sessionAmountKurus: 12000,
        sessionRefundedKurus: 0,
      })
    ).toEqual({ ok: true, operation: "SaleReversal", amountKurus: 12000 });
  });

  it("same day, partial → refused (bank only reverses whole sales before end of day)", () => {
    const plan = planKuveytTurkRefund({
      paidAt,
      now: new Date("2026-10-08T18:00:00Z"),
      refundAmount: "20.00",
      sessionAmountKurus: 12000,
      sessionRefundedKurus: 0,
    });
    expect(plan.ok).toBe(false);
  });

  it("uses the İstanbul calendar day: 23:30 UTC is already the next day", () => {
    const plan = planKuveytTurkRefund({
      paidAt,
      now: new Date("2026-10-08T21:30:00Z"), // 00:30 on 9 Oct in İstanbul
      refundAmount: "120.00",
      sessionAmountKurus: 12000,
      sessionRefundedKurus: 0,
    });
    expect(plan).toMatchObject({ ok: true, operation: "DrawBack" });
  });

  it("later: full → DrawBack, part or after a previous refund → PartialDrawback", () => {
    const later = new Date("2026-10-10T10:00:00Z");
    expect(
      planKuveytTurkRefund({ paidAt, now: later, refundAmount: "20", sessionAmountKurus: 12000, sessionRefundedKurus: 0 })
    ).toEqual({ ok: true, operation: "PartialDrawback", amountKurus: 2000 });
    expect(
      planKuveytTurkRefund({ paidAt, now: later, refundAmount: "100", sessionAmountKurus: 12000, sessionRefundedKurus: 2000 })
    ).toEqual({ ok: true, operation: "PartialDrawback", amountKurus: 10000 });
    expect(
      planKuveytTurkRefund({ paidAt, now: later, refundAmount: "100.01", sessionAmountKurus: 12000, sessionRefundedKurus: 2000 }).ok
    ).toBe(false);
  });

  it("a cart session paying two invoices: refunding one invoice in full is a partial drawback", () => {
    expect(
      planKuveytTurkRefund({
        paidAt,
        now: new Date("2026-10-12T10:00:00Z"),
        refundAmount: "60",
        sessionAmountKurus: 18000,
        sessionRefundedKurus: 0,
      })
    ).toMatchObject({ ok: true, operation: "PartialDrawback" });
  });
});

describe("e-fatura decision", () => {
  const now = new Date("2026-10-08T12:00:00Z");
  const sent = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  it("cancels an issued e-Arşiv within 7 days on a full refund", () => {
    expect(
      decideEInvoiceAction({ record: { type: "e-arsiv", status: "ACCEPTED", sentAt: sent(2) }, fullyRefunded: true, now })
    ).toBe("EARSIV_CANCEL");
  });

  it("flags a return invoice after the window, on partial refunds and for e-Fatura", () => {
    expect(
      decideEInvoiceAction({ record: { type: "e-arsiv", status: "ACCEPTED", sentAt: sent(8) }, fullyRefunded: true, now })
    ).toBe("RETURN_INVOICE_REQUIRED");
    expect(
      decideEInvoiceAction({ record: { type: "e-arsiv", status: "SENT", sentAt: sent(1) }, fullyRefunded: false, now })
    ).toBe("RETURN_INVOICE_REQUIRED");
    expect(
      decideEInvoiceAction({ record: { type: "e-fatura", status: "ACCEPTED", sentAt: sent(1) }, fullyRefunded: true, now })
    ).toBe("RETURN_INVOICE_REQUIRED");
  });

  it("does nothing when no official invoice was issued", () => {
    expect(decideEInvoiceAction({ record: null, fullyRefunded: true, now })).toBeNull();
    expect(
      decideEInvoiceAction({ record: { type: "e-arsiv", status: "FAILED", sentAt: null }, fullyRefunded: true, now })
    ).toBeNull();
  });
});
