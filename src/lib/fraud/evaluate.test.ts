import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  emitEvent: vi.fn(),
  db: { fraudCheck: { findMany: vi.fn() } },
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/events/emit", () => ({ emitEvent: mocks.emitEvent }));

import type { Prisma } from "@prisma/client";
import { evaluateCheckoutOrders, getPaymentBlock, PAYMENT_BLOCKED_MESSAGE, ORDER_REJECTED_MESSAGE, reevaluateOrderAtPayment } from "./evaluate";
import { DEFAULT_FRAUD_CONFIG, scoreSignals } from "./rules";

const NOW = new Date("2026-10-09T12:00:00Z");

function fakeTx(opts: { previousOrders?: number; sameIp?: number; email?: string; createdAt?: Date; check?: Record<string, unknown> | null } = {}) {
  const created: Array<Record<string, unknown>> = [];
  const updated: Array<Record<string, unknown>> = [];
  const tx = {
    user: {
      findUnique: vi.fn(async () => ({
        email: opts.email ?? "ayse@gmail.com",
        name: "Ayşe",
        surname: "Yılmaz",
        companyName: null,
        createdAt: opts.createdAt ?? new Date("2025-01-01T00:00:00Z"),
      })),
    },
    order: { count: vi.fn(async () => opts.previousOrders ?? 0) },
    fraudCheck: {
      count: vi.fn(async () => opts.sameIp ?? 0),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => created.push(data)),
      findUnique: vi.fn(async () => opts.check ?? null),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => updated.push(data)),
    },
    orderActivity: { create: vi.fn() },
  };
  return { tx: tx as unknown as Prisma.TransactionClient, raw: tx, created, updated };
}

const base = { customerId: "cus-1", ipAddress: "203.0.113.5", ipCountrySource: "db" as const, now: NOW };

beforeEach(() => {
  mocks.emitEvent.mockResolvedValue({ id: "evt", queued: true });
});

describe("evaluateCheckoutOrders", () => {
  it("stores a PASSED check for a low score and emits nothing", async () => {
    const { tx, created } = fakeTx({ previousOrders: 3 });
    const outcomes = await evaluateCheckoutOrders(
      tx,
      { ...base, ipCountry: "TR", orders: [{ id: "o1", orderNumber: "S-1", categorySlug: "vds" }] },
      DEFAULT_FRAUD_CONFIG
    );
    expect(outcomes).toEqual([{ orderId: "o1", score: 0, status: "PASSED", paymentBlocked: false }]);
    expect(created[0]).toMatchObject({ orderId: "o1", status: "PASSED", score: 0, threshold: 50, ipAddress: "203.0.113.5", ipCountry: "TR" });
    expect(mocks.emitEvent).not.toHaveBeenCalled();
  });

  it("flags the first VDS order from abroad for review and tells customer + staff", async () => {
    const { tx, created } = fakeTx({ previousOrders: 0 });
    const outcomes = await evaluateCheckoutOrders(
      tx,
      {
        ...base,
        ipCountry: "NL",
        orders: [
          { id: "o1", orderNumber: "S-1", categorySlug: "vds" },
          { id: "o2", orderNumber: "S-2", categorySlug: "domain" },
        ],
      },
      DEFAULT_FRAUD_CONFIG
    );
    expect(outcomes.map((o) => [o.orderId, o.status, o.score])).toEqual([
      ["o1", "REVIEW", 55],
      ["o2", "PASSED", 25],
    ]);
    expect(created[0].status).toBe("REVIEW");
    expect(mocks.emitEvent).toHaveBeenCalledTimes(1);
    expect(mocks.emitEvent).toHaveBeenCalledWith(
      tx,
      "order.review_required",
      expect.objectContaining({ orderId: "o1", score: 55, threshold: 50, paymentBlocked: false, stage: "checkout" })
    );
  });

  it("blocks the payment over the block threshold; counts IP velocity without the cart's own orders", async () => {
    const { tx, raw } = fakeTx({ previousOrders: 0, sameIp: 5, email: "x@mailinator.com", createdAt: new Date(NOW.getTime() - 3600_000) });
    const config = { ...DEFAULT_FRAUD_CONFIG, blockThreshold: 90 };
    const [outcome] = await evaluateCheckoutOrders(
      tx,
      { ...base, ipCountry: "TR", orders: [{ id: "o1", orderNumber: "S-1", categorySlug: "server" }] },
      config
    );
    // first server 30 + disposable 40 + velocity 20 + new account 15
    expect(outcome).toMatchObject({ score: 105, status: "REVIEW", paymentBlocked: true });
    const countWhere = (raw.fraudCheck.count.mock.calls[0] as unknown as [{ where: Record<string, any> }])[0].where;
    expect(countWhere.orderId).toEqual({ notIn: ["o1"] });
    expect(countWhere.ipAddress).toBe("203.0.113.5");
  });

  it("does nothing when disabled", async () => {
    const { tx, created } = fakeTx();
    expect(
      await evaluateCheckoutOrders(tx, { ...base, ipCountry: "NL", orders: [{ id: "o1", orderNumber: "S-1", categorySlug: "vds" }] }, { ...DEFAULT_FRAUD_CONFIG, enabled: false })
    ).toEqual([]);
    expect(created).toHaveLength(0);
  });
});

describe("reevaluateOrderAtPayment", () => {
  const checkoutRules = scoreSignals({ categorySlug: "vds", previousOrders: 0, ipCountry: "TR" }).results; // 30

  function check(status: string) {
    return {
      id: "fc-1",
      status,
      rules: checkoutRules,
      customerId: "cus-1",
      cardCountry: null,
      order: { orderNumber: "S-1", customer: { name: "Ayşe", surname: "Yılmaz", companyName: null } },
    };
  }

  it("moves a PASSED order to REVIEW when the card adds enough risk", async () => {
    const { tx, updated } = fakeTx({ check: check("PASSED") });
    const result = await reevaluateOrderAtPayment(tx, "o1", { binCountry: "GB", holderName: "Ayşe Yılmaz" }, DEFAULT_FRAUD_CONFIG);
    expect(result).toEqual({ changed: true, review: true });
    expect(updated[0]).toMatchObject({ score: 55, status: "REVIEW", cardCountry: "GB", stage: "payment" });
    expect(mocks.emitEvent).toHaveBeenCalledWith(tx, "order.review_required", expect.objectContaining({ stage: "payment", score: 55 }));
  });

  it("only rescores when below the threshold, and never touches staff decisions", async () => {
    const low = fakeTx({ check: check("PASSED") });
    expect(await reevaluateOrderAtPayment(low.tx, "o1", { holderName: "Ayşe Yılmaz" }, DEFAULT_FRAUD_CONFIG)).toEqual({ changed: true, review: false });
    expect(low.updated[0].status).toBeUndefined();

    const approved = fakeTx({ check: check("APPROVED") });
    expect(await reevaluateOrderAtPayment(approved.tx, "o1", { binCountry: "GB", holderName: "John Smith" }, DEFAULT_FRAUD_CONFIG)).toEqual({ changed: false, review: false });
    expect(approved.updated).toHaveLength(0);
    expect(mocks.emitEvent).not.toHaveBeenCalled();
  });

  it("ignores empty card data", async () => {
    const { tx, raw } = fakeTx({ check: check("PASSED") });
    expect(await reevaluateOrderAtPayment(tx, "o1", { binCountry: " ", holderName: null }, DEFAULT_FRAUD_CONFIG)).toEqual({ changed: false, review: false });
    expect(raw.fraudCheck.findUnique).not.toHaveBeenCalled();
  });
});

describe("getPaymentBlock", () => {
  it("refuses blocked reviews and rejected orders, allows everything else", async () => {
    mocks.db.fraudCheck.findMany.mockResolvedValueOnce([]);
    expect(await getPaymentBlock(["inv-1"])).toBeNull();
    mocks.db.fraudCheck.findMany.mockResolvedValueOnce([{ status: "REVIEW" }]);
    expect(await getPaymentBlock(["inv-1"])).toBe(PAYMENT_BLOCKED_MESSAGE);
    mocks.db.fraudCheck.findMany.mockResolvedValueOnce([{ status: "REVIEW" }, { status: "REJECTED" }]);
    expect(await getPaymentBlock(["inv-1"])).toBe(ORDER_REJECTED_MESSAGE);
    expect(await getPaymentBlock([])).toBeNull();

    const where = (mocks.db.fraudCheck.findMany.mock.calls[0] as unknown as [{ where: Record<string, unknown> }])[0].where;
    expect(where.OR).toEqual([{ status: "REVIEW", paymentBlocked: true }, { status: "REJECTED" }]);
  });

  it("never stops a payment because the lookup failed", async () => {
    mocks.db.fraudCheck.findMany.mockRejectedValueOnce(new Error("db down"));
    expect(await getPaymentBlock(["inv-1"])).toBeNull();
  });
});
