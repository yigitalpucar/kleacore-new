import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  db: {} as Record<string, unknown>,
  executeGatewayRefund: vi.fn(),
  cancelEInvoiceRecord: vi.fn(),
  terminateRemoteService: vi.fn(),
  sendNotification: vi.fn(),
  logActivity: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/activity-log", () => ({ logActivity: mocks.logActivity }));
vi.mock("@/lib/integrations/efatura", () => ({ cancelEInvoiceRecord: mocks.cancelEInvoiceRecord }));
vi.mock("@/lib/integrations/payment-gateways/config", () => ({ getPaymentGatewayConfig: async () => ({}) }));
vi.mock("@/lib/integrations/provisioning", () => ({ terminateRemoteService: mocks.terminateRemoteService }));
vi.mock("@/lib/notifications/send", () => ({ sendNotification: mocks.sendNotification }));
vi.mock("./refunds-gateways", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./refunds-gateways")>()),
  executeGatewayRefund: mocks.executeGatewayRefund,
}));

import { createRefund, resolvePendingRefund, type CreateRefundInput } from "./refunds";

const D = (value: string | number) => new Prisma.Decimal(value);

type Row = Record<string, unknown> & { id: string };

function createFakeDb() {
  const state = {
    invoices: new Map<string, Row>(),
    payments: [] as Row[],
    refunds: [] as Row[],
    users: new Map<string, Row>(),
    orders: new Map<string, Row>(),
    services: new Map<string, Row>(),
    transactions: [] as Row[],
    eInvoiceRecords: new Map<string, Row>(),
  };
  let seq = 0;
  // Interactive transactions run one at a time — what the invoice row lock
  // (SELECT … FOR UPDATE) guarantees for refunds of one invoice.
  let chain: Promise<unknown> = Promise.resolve();
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

  const refundsOf = (invoiceId: string) => state.refunds.filter((refund) => refund.invoiceId === invoiceId);
  const matchStatus = (value: unknown, where: unknown) =>
    where === undefined ||
    (typeof where === "string" ? value === where : (where as { in: string[] }).in.includes(value as string));

  const db = {
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => {
      const run = chain.then(() => fn(db));
      chain = run.catch(() => undefined);
      return run;
    },
    $queryRaw: async () => [],
    refund: {
      findUnique: async ({ where }: { where: { id?: string; idempotencyKey?: string } }) =>
        state.refunds.find((refund) =>
          where.id ? refund.id === where.id : refund.idempotencyKey === where.idempotencyKey
        ) ?? null,
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const refund = state.refunds.find((candidate) => candidate.id === where.id);
        if (!refund) throw new Error("not found");
        return { ...refund };
      },
      create: async ({ data }: { data: Row }) => {
        await tick();
        if (state.refunds.some((refund) => refund.idempotencyKey === data.idempotencyKey)) {
          throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
            code: "P2002",
            clientVersion: "7.4.2",
          });
        }
        const refund = {
          status: "PENDING",
          eInvoiceAction: null,
          createdAt: new Date(),
          completedAt: null,
          ...data,
          id: `ref-${++seq}`,
        };
        state.refunds.push(refund);
        return { ...refund };
      },
      updateMany: async ({ where, data }: { where: { id: string; status?: string }; data: Row }) => {
        const refund = state.refunds.find((candidate) => candidate.id === where.id);
        if (!refund || (where.status && refund.status !== where.status)) return { count: 0 };
        Object.assign(refund, data);
        return { count: 1 };
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const refund = state.refunds.find((candidate) => candidate.id === where.id)!;
        Object.assign(refund, data);
        return refund;
      },
      findMany: async ({ where }: { where: { paymentId: { in: string[] }; status: { in: string[] }; id: { not: string } } }) =>
        state.refunds.filter(
          (refund) =>
            where.paymentId.in.includes(refund.paymentId as string) &&
            where.status.in.includes(refund.status as string) &&
            refund.id !== where.id.not
        ),
    },
    invoice: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        await tick();
        const invoice = state.invoices.get(where.id);
        if (!invoice) return null;
        return {
          ...invoice,
          payments: state.payments.filter(
            (payment) => payment.invoiceId === invoice.id && ["COMPLETED", "REFUNDED"].includes(payment.status as string)
          ),
          refunds: refundsOf(invoice.id).map((refund) => ({ ...refund })),
          order: invoice.orderId ? state.orders.get(invoice.orderId as string) ?? null : null,
        };
      },
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const invoice = state.invoices.get(where.id)!;
        return { ...invoice, order: invoice.orderId ? state.orders.get(invoice.orderId as string) ?? null : null };
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) => {
        Object.assign(state.invoices.get(where.id)!, data);
        return state.invoices.get(where.id);
      },
    },
    payment: {
      findMany: async ({ where }: { where: { transactionId: string; status: unknown } }) =>
        state.payments.filter(
          (payment) => payment.transactionId === where.transactionId && matchStatus(payment.status, where.status)
        ),
      updateMany: async ({ where, data }: { where: { invoiceId: string; status: string }; data: Row }) => {
        const matched = state.payments.filter(
          (payment) => payment.invoiceId === where.invoiceId && payment.status === where.status
        );
        matched.forEach((payment) => Object.assign(payment, data));
        return { count: matched.length };
      },
    },
    order: {
      update: async ({ where, data }: { where: { id: string }; data: Row }) =>
        Object.assign(state.orders.get(where.id)!, data),
    },
    user: {
      update: async ({ where, data }: { where: { id: string }; data: { balance: { increment: Prisma.Decimal } } }) => {
        const user = state.users.get(where.id)!;
        user.balance = (user.balance as Prisma.Decimal).plus(data.balance.increment);
        return { balance: user.balance };
      },
    },
    transaction: {
      create: async ({ data }: { data: Row }) => {
        state.transactions.push(data);
        return data;
      },
    },
    service: {
      updateMany: async ({ where, data }: { where: { id: string }; data: Row }) => {
        const service = state.services.get(where.id);
        if (!service || service.status === "CANCELLED") return { count: 0 };
        Object.assign(service, data);
        return { count: 1 };
      },
      findUnique: async ({ where }: { where: { id: string } }) => state.services.get(where.id) ?? null,
    },
    eInvoiceRecord: {
      findUnique: async ({ where }: { where: { invoiceId: string } }) => state.eInvoiceRecords.get(where.invoiceId) ?? null,
    },
  };

  return { state, db };
}

let store: ReturnType<typeof createFakeDb>;

function seed(options: { method?: "CREDIT_CARD" | "BANK_TRANSFER"; paid?: string } = {}) {
  const paid = options.paid ?? "120.00";
  store.state.invoices.set("inv-1", {
    id: "inv-1",
    invoiceNumber: "F-2026-000001",
    customerId: "cus-1",
    status: "PAID",
    totalAmount: D(paid),
    paidAmount: D(paid),
    refundedAmount: D(0),
    orderId: "ord-1",
  });
  store.state.orders.set("ord-1", { id: "ord-1", serviceId: "svc-1", status: "COMPLETED" });
  store.state.services.set("svc-1", { id: "svc-1", status: "ACTIVE" });
  store.state.users.set("cus-1", { id: "cus-1", balance: D("5.00") });
  store.state.payments.push({
    id: "pay-1",
    invoiceId: "inv-1",
    customerId: "cus-1",
    amount: D(paid),
    method: options.method ?? "CREDIT_CARD",
    status: "COMPLETED",
    transactionId: options.method === "BANK_TRANSFER" ? "HVL-1" : "KL1728390000000a1b2c3d4",
    notes: options.method === "BANK_TRANSFER" ? "Havale/EFT onaylandı" : "PayTR iframe ödemesi",
    gatewayData: null,
    paidAt: new Date("2026-10-01T10:00:00Z"),
    createdAt: new Date("2026-10-01T09:59:00Z"),
  });
}

function input(overrides: Partial<CreateRefundInput> = {}): CreateRefundInput {
  return {
    invoiceId: "inv-1",
    amount: "120.00",
    reason: "Müşteri talebi",
    method: "GATEWAY",
    serviceAction: "KEEP",
    idempotencyKey: "key-1",
    createdBy: "admin-1",
    ...overrides,
  };
}

const invoice = () => store.state.invoices.get("inv-1")!;

beforeEach(() => {
  store = createFakeDb();
  for (const key of Object.keys(mocks.db)) delete mocks.db[key];
  Object.assign(mocks.db, store.db);
  mocks.executeGatewayRefund.mockReset();
  mocks.executeGatewayRefund.mockResolvedValue({ ok: true, operation: "iade", gatewayRef: "KL1", message: "PayTR iadeyi onayladı." });
  mocks.cancelEInvoiceRecord.mockReset();
  mocks.sendNotification.mockReset();
  mocks.terminateRemoteService.mockReset();
});

describe("createRefund — amount bounds", () => {
  it("refuses more than paid minus refunded", async () => {
    seed();
    await expect(createRefund(input({ amount: "120.01" }))).rejects.toThrow(/aşamaz/);
    expect(store.state.refunds).toHaveLength(0);
    expect(mocks.executeGatewayRefund).not.toHaveBeenCalled();
  });

  it("counts earlier partial refunds against the bound", async () => {
    seed();
    await createRefund(input({ amount: "100.00", idempotencyKey: "a" }));
    await expect(createRefund(input({ amount: "20.01", idempotencyKey: "b" }))).rejects.toThrow(/aşamaz/);
    const last = await createRefund(input({ amount: "20.00", idempotencyKey: "c" }));
    expect(last.status).toBe("COMPLETED");
    expect(String(invoice().refundedAmount)).toBe("120");
  });

  it("refuses unpaid invoices and a gateway refund of a havale payment", async () => {
    seed();
    invoice().status = "PENDING";
    await expect(createRefund(input())).rejects.toThrow(/ödenmiş/);

    store = createFakeDb();
    Object.assign(mocks.db, store.db);
    seed({ method: "BANK_TRANSFER" });
    await expect(createRefund(input())).rejects.toThrow(/kartla ödenmemiş/);
  });
});

describe("createRefund — status transitions", () => {
  it("PAID → PARTIALLY_REFUNDED → REFUNDED and payments marked REFUNDED at the end", async () => {
    seed();
    await createRefund(input({ amount: "20.00", idempotencyKey: "p1" }));
    expect(invoice().status).toBe("PARTIALLY_REFUNDED");
    expect(store.state.payments[0].status).toBe("COMPLETED");
    expect(store.state.orders.get("ord-1")).toMatchObject({ status: "COMPLETED" });

    await createRefund(input({ amount: "100.00", idempotencyKey: "p2" }));
    expect(invoice().status).toBe("REFUNDED");
    expect(String(invoice().refundedAmount)).toBe("120");
    expect(store.state.payments[0].status).toBe("REFUNDED");
    expect(store.state.orders.get("ord-1")).toMatchObject({ status: "REFUNDED" });
  });

  it("a gateway rejection marks the refund FAILED and leaves the invoice untouched", async () => {
    seed();
    mocks.executeGatewayRefund.mockResolvedValueOnce({ ok: false, message: "PayTR iadeyi reddetti: limit" });

    const outcome = await createRefund(input());

    expect(outcome.status).toBe("FAILED");
    expect(store.state.refunds[0]).toMatchObject({ status: "FAILED", errorMessage: "PayTR iadeyi reddetti: limit" });
    expect(invoice()).toMatchObject({ status: "PAID" });
    // A failed attempt frees the amount again.
    expect((await createRefund(input({ idempotencyKey: "retry" }))).status).toBe("COMPLETED");
  });

  it("an unknown gateway outcome stays PENDING, blocks a second refund and can be resolved", async () => {
    seed();
    mocks.executeGatewayRefund.mockResolvedValue({ ok: false, uncertain: true, message: "PayTR'ye ulaşılamadı" });

    const outcome = await createRefund(input());
    expect(outcome.status).toBe("PENDING");
    expect(invoice().status).toBe("PAID");
    await expect(createRefund(input({ idempotencyKey: "other", amount: "1.00" }))).rejects.toThrow(/aşamaz/);

    const resolved = await resolvePendingRefund(outcome.refundId, "COMPLETED", "admin-1");
    expect(resolved.status).toBe("COMPLETED");
    expect(invoice().status).toBe("REFUNDED");
    await expect(resolvePendingRefund(outcome.refundId, "COMPLETED", "admin-1")).rejects.toThrow(/sonuçlanmış/);
  });
});

describe("createRefund — idempotency", () => {
  it("a repeated submit (double click) refunds once", async () => {
    seed();
    const first = await createRefund(input({ amount: "50.00" }));
    const second = await createRefund(input({ amount: "50.00" }));

    expect(second).toMatchObject({ refundId: first.refundId, duplicate: true });
    expect(store.state.refunds).toHaveLength(1);
    expect(mocks.executeGatewayRefund).toHaveBeenCalledTimes(1);
    expect(String(invoice().refundedAmount)).toBe("50");
  });

  it("concurrent submits with the same key create one refund", async () => {
    seed();
    const results = await Promise.all([
      createRefund(input({ amount: "50.00" })),
      createRefund(input({ amount: "50.00" })),
      createRefund(input({ amount: "50.00" })),
    ]);

    expect(new Set(results.map((result) => result.refundId)).size).toBe(1);
    expect(results.filter((result) => result.duplicate)).toHaveLength(2);
    expect(store.state.refunds).toHaveLength(1);
    expect(mocks.executeGatewayRefund).toHaveBeenCalledTimes(1);
  });

  it("concurrent refunds with different keys never exceed the paid amount", async () => {
    seed();
    const results = await Promise.allSettled([
      createRefund(input({ amount: "80.00", idempotencyKey: "x" })),
      createRefund(input({ amount: "80.00", idempotencyKey: "y" })),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(String(invoice().refundedAmount)).toBe("80");
  });
});

describe("createRefund — balance, service and e-fatura", () => {
  it("BALANCE credits the customer and writes a REFUND ledger row", async () => {
    seed();
    await createRefund(input({ method: "BALANCE", amount: "30.00" }));

    expect(String(store.state.users.get("cus-1")!.balance)).toBe("35");
    expect(store.state.transactions[0]).toMatchObject({ type: "REFUND", customerId: "cus-1" });
    expect(String(store.state.transactions[0].balanceBefore)).toBe("5");
    expect(mocks.executeGatewayRefund).not.toHaveBeenCalled();
  });

  it("MANUAL records the reference and cancels the service when asked", async () => {
    seed();
    await createRefund(input({ method: "MANUAL", serviceAction: "CANCEL", manualReference: "EFT-778" }));

    expect(store.state.refunds[0]).toMatchObject({ method: "MANUAL", gatewayRef: "EFT-778", status: "COMPLETED" });
    expect(store.state.services.get("svc-1")).toMatchObject({ status: "CANCELLED" });
    expect(mocks.terminateRemoteService).toHaveBeenCalledTimes(1);
  });

  it("keeps the service by default", async () => {
    seed();
    await createRefund(input());
    expect(store.state.services.get("svc-1")).toMatchObject({ status: "ACTIVE" });
    expect(mocks.terminateRemoteService).not.toHaveBeenCalled();
  });

  it("cancels a fresh e-Arşiv on a full refund", async () => {
    seed();
    store.state.eInvoiceRecords.set("inv-1", {
      id: "einv-1",
      type: "e-arsiv",
      status: "ACCEPTED",
      sentAt: new Date(),
    });

    const outcome = await createRefund(input());

    expect(mocks.cancelEInvoiceRecord).toHaveBeenCalledWith("einv-1", "İade: Müşteri talebi");
    expect(outcome.eInvoiceAction).toBe("EARSIV_CANCELLED");
  });

  it("flags 'iade faturası gerekli' on a partial refund or when the cancel fails", async () => {
    seed();
    store.state.eInvoiceRecords.set("inv-1", { id: "einv-1", type: "e-arsiv", status: "ACCEPTED", sentAt: new Date() });

    const partial = await createRefund(input({ amount: "20.00", idempotencyKey: "part" }));
    expect(partial.eInvoiceAction).toBe("RETURN_INVOICE_REQUIRED");
    expect(mocks.cancelEInvoiceRecord).not.toHaveBeenCalled();

    mocks.cancelEInvoiceRecord.mockRejectedValue(new Error("EFATURA_RECORD_NOT_CANCELLABLE"));
    const rest = await createRefund(input({ amount: "100.00", idempotencyKey: "rest" }));
    expect(rest.eInvoiceAction).toBe("RETURN_INVOICE_REQUIRED");
    expect(store.state.refunds.find((refund) => refund.id === rest.refundId)).toMatchObject({
      eInvoiceAction: "RETURN_INVOICE_REQUIRED",
    });
  });

  it("notifies the customer", async () => {
    seed();
    await createRefund(input({ amount: "10.00" }));
    expect(mocks.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "cus-1", template: "invoice.refunded" })
    );
  });
});
