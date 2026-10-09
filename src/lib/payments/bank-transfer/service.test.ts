import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {} as Record<string, unknown>,
  fulfillInvoicePayment: vi.fn(),
  finalizeFulfilledInvoices: vi.fn(),
  emitEvent: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/payments/fulfillment", () => ({
  fulfillInvoicePayment: mocks.fulfillInvoicePayment,
  finalizeFulfilledInvoices: mocks.finalizeFulfilledInvoices,
}));
vi.mock("@/lib/events/emit", () => ({ emitEvent: mocks.emitEvent }));

import {
  approveBankTransferNotice,
  parseNoticeInput,
  rejectBankTransferNotice,
  submitBankTransferNotice,
} from "./service";

type Row = Record<string, unknown> & { id: string };

function createFakeDb() {
  const state = {
    invoices: new Map<string, Row>([
      ["inv-1", { id: "inv-1", customerId: "cus-1", status: "PENDING", invoiceNumber: "F-2026-000007" }],
    ]),
    notices: [] as Row[],
    payments: [] as Row[],
    accounts: [{ id: "acc-1", isActive: true }] as Row[],
    /** Fraud checks of the invoice's order (getPaymentBlock). */
    fraudChecks: [] as Array<{ invoiceId: string; status: string; paymentBlocked: boolean }>,
  };
  let seq = 0;
  let chain: Promise<unknown> = Promise.resolve();

  const db = {
    $transaction: (fn: (tx: unknown) => Promise<unknown>) => {
      const run = chain.then(() => fn(db));
      chain = run.catch(() => undefined);
      return run;
    },
    fraudCheck: {
      findMany: async ({ where }: { where: { order: { invoice: { id: { in: string[] } } } } }) =>
        state.fraudChecks
          .filter((check) => where.order.invoice.id.in.includes(check.invoiceId))
          .filter((check) => (check.status === "REVIEW" && check.paymentBlocked) || check.status === "REJECTED")
          .map((check) => ({ status: check.status })),
    },
    invoice: {
      findUnique: async ({ where }: { where: { id: string } }) => state.invoices.get(where.id) ?? null,
    },
    bankAccount: {
      findFirst: async ({ where }: { where: { id: string } }) =>
        state.accounts.find((account) => account.id === where.id && account.isActive) ?? null,
    },
    bankTransferNotice: {
      count: async ({ where }: { where: { invoiceId: string; status: string } }) =>
        state.notices.filter((notice) => notice.invoiceId === where.invoiceId && notice.status === where.status).length,
      create: async ({ data }: { data: Row }) => {
        const notice = { status: "PENDING", ...data, id: `notice-${++seq}` };
        state.notices.push(notice);
        return notice;
      },
      updateMany: async ({ where, data }: { where: { id: string; status: string }; data: Row }) => {
        const notice = state.notices.find((candidate) => candidate.id === where.id && candidate.status === where.status);
        if (!notice) return { count: 0 };
        Object.assign(notice, data);
        return { count: 1 };
      },
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const notice = state.notices.find((candidate) => candidate.id === where.id)!;
        return { ...notice, invoice: { ...state.invoices.get(notice.invoiceId as string)! } };
      },
    },
    payment: {
      findFirst: async ({ where }: { where: Row }) =>
        state.payments.find(
          (payment) =>
            payment.invoiceId === where.invoiceId &&
            payment.method === where.method &&
            payment.status === where.status &&
            payment.transactionId === null
        ) ?? null,
      create: async ({ data }: { data: Row }) => {
        const payment = { transactionId: null, ...data, id: `pay-${++seq}` };
        state.payments.push(payment);
        return payment;
      },
      update: async ({ where, data }: { where: { id: string }; data: Row }) =>
        Object.assign(state.payments.find((payment) => payment.id === where.id)!, data),
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        const matched = state.payments.filter(
          (payment) =>
            payment.invoiceId === where.invoiceId &&
            payment.status === where.status &&
            payment.transactionId === null
        );
        matched.forEach((payment) => Object.assign(payment, data));
        return { count: matched.length };
      },
    },
  };
  return { state, db };
}

let store: ReturnType<typeof createFakeDb>;

const notice = {
  customerId: "cus-1",
  invoiceId: "inv-1",
  amount: "1.234,50",
  transferDate: "2026-10-07",
  senderName: "Ayşe Yılmaz",
  bankAccountId: "acc-1",
};

beforeEach(() => {
  store = createFakeDb();
  for (const key of Object.keys(mocks.db)) delete mocks.db[key];
  Object.assign(mocks.db, store.db);
  mocks.fulfillInvoicePayment.mockReset();
  mocks.fulfillInvoicePayment.mockImplementation(async (_tx, input: { invoiceId: string }) => {
    store.state.invoices.get(input.invoiceId)!.status = "PAID";
    return { fulfilled: true };
  });
  mocks.emitEvent.mockReset();
});

describe("parseNoticeInput", () => {
  const now = new Date("2026-10-08T12:00:00Z");

  it("parses Turkish amounts and trims the sender", () => {
    const parsed = parseNoticeInput({ ...notice, senderName: "  Ayşe Yılmaz " }, now);
    expect(parsed.amount.toString()).toBe("1234.5");
    expect(parsed.senderName).toBe("Ayşe Yılmaz");
  });

  it("rejects zero amounts, future dates and missing sender", () => {
    expect(() => parseNoticeInput({ ...notice, amount: "0" }, now)).toThrow(/tutarı/);
    expect(() => parseNoticeInput({ ...notice, transferDate: "2026-10-12" }, now)).toThrow(/ileri/);
    expect(() => parseNoticeInput({ ...notice, senderName: " " }, now)).toThrow(/Gönderen/);
  });
});

describe("submitBankTransferNotice", () => {
  it("creates the notice and one pending BANK_TRANSFER payment; a second pending notice is refused", async () => {
    await submitBankTransferNotice(notice);

    expect(store.state.notices).toHaveLength(1);
    expect(store.state.payments).toHaveLength(1);
    expect(store.state.payments[0]).toMatchObject({ method: "BANK_TRANSFER", status: "PENDING" });
    expect(String(store.state.payments[0].amount)).toBe("1234.5");

    await expect(submitBankTransferNotice(notice)).rejects.toThrow(/onay bekleyen/);
  });

  it("refuses another customer's invoice and paid invoices", async () => {
    await expect(submitBankTransferNotice({ ...notice, customerId: "cus-2" })).rejects.toThrow(/bulunamadı/);
    store.state.invoices.get("inv-1")!.status = "PAID";
    await expect(submitBankTransferNotice(notice)).rejects.toThrow(/ödemeye açık değil/);
  });
});

describe("fraud review block (havale must not bypass it)", () => {
  it("refuses a havale notice while the order's review blocks payment, or after a rejection", async () => {
    store.state.fraudChecks.push({ invoiceId: "inv-1", status: "REVIEW", paymentBlocked: true });
    await expect(submitBankTransferNotice(notice)).rejects.toThrow(/güvenlik incelemesinde, onaylandığında ödeme yapabilirsiniz/);
    store.state.fraudChecks[0].status = "REJECTED";
    await expect(submitBankTransferNotice(notice)).rejects.toThrow(/onaylanmadı/);
    expect(store.state.notices).toHaveLength(0);
    expect(store.state.payments).toHaveLength(0);
  });

  it("allows a notice when the review only holds provisioning (no payment block)", async () => {
    store.state.fraudChecks.push({ invoiceId: "inv-1", status: "REVIEW", paymentBlocked: false });
    await submitBankTransferNotice(notice);
    expect(store.state.notices).toHaveLength(1);
  });

  it("staff cannot approve a notice whose order got blocked after it was sent", async () => {
    await submitBankTransferNotice(notice);
    store.state.fraudChecks.push({ invoiceId: "inv-1", status: "REVIEW", paymentBlocked: true });
    await expect(approveBankTransferNotice(store.state.notices[0].id, "admin-1")).rejects.toThrow(/güvenlik incelemesinde/);
    expect(mocks.fulfillInvoicePayment).not.toHaveBeenCalled();
    // In Postgres the throw rolls the claim back (same transaction), so the
    // notice stays pending for after the review; the fake db has no rollback.
  });
});

describe("approve / reject", () => {
  it("approves once through the fulfilment path with the notice reference", async () => {
    await submitBankTransferNotice(notice);
    const id = store.state.notices[0].id;

    await approveBankTransferNotice(id, "admin-1");
    await expect(approveBankTransferNotice(id, "admin-1")).rejects.toThrow(/sonuçlandırılmış/);

    expect(mocks.fulfillInvoicePayment).toHaveBeenCalledTimes(1);
    expect(mocks.fulfillInvoicePayment.mock.calls[0][1]).toMatchObject({
      invoiceId: "inv-1",
      performedBy: "admin-1",
      paymentReference: `HVL-${id}`,
    });
    expect(store.state.payments[0]).toMatchObject({ transactionId: `HVL-${id}` });
    expect(store.state.notices[0]).toMatchObject({ status: "APPROVED", reviewedBy: "admin-1" });
    // Approval event commits with the payment (notice sent by the outbox
    // subscriber with the same template + dedupe key); post-commit steps run once.
    expect(mocks.emitEvent).toHaveBeenCalledWith(
      expect.anything(),
      "bank_transfer.approved",
      expect.objectContaining({ noticeId: id, customerId: "cus-1", invoiceId: "inv-1" }),
      { actorId: "admin-1" }
    );
    expect(mocks.finalizeFulfilledInvoices).toHaveBeenCalledTimes(1);
  });

  it("concurrent approvals settle the invoice once", async () => {
    await submitBankTransferNotice(notice);
    const id = store.state.notices[0].id;

    const results = await Promise.allSettled([
      approveBankTransferNotice(id, "admin-1"),
      approveBankTransferNotice(id, "admin-2"),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(mocks.fulfillInvoicePayment).toHaveBeenCalledTimes(1);
  });

  it("does not approve a notice for an invoice that is already paid", async () => {
    await submitBankTransferNotice(notice);
    store.state.invoices.get("inv-1")!.status = "PAID";
    // The fake has no rollback; the service throws before fulfilment.
    await expect(approveBankTransferNotice(store.state.notices[0].id, "admin-1")).rejects.toThrow(/zaten ödenmiş/);
    expect(mocks.fulfillInvoicePayment).not.toHaveBeenCalled();
  });

  it("rejects with a reason, closes the pending payment and notifies the customer", async () => {
    await submitBankTransferNotice(notice);
    const id = store.state.notices[0].id;

    await expect(rejectBankTransferNotice(id, "admin-1", " ")).rejects.toThrow(/Ret nedeni/);
    await rejectBankTransferNotice(id, "admin-1", "Hesaba ulaşmadı");

    expect(store.state.notices[0]).toMatchObject({ status: "REJECTED", rejectionReason: "Hesaba ulaşmadı" });
    expect(store.state.payments[0]).toMatchObject({ status: "FAILED" });
    expect(mocks.emitEvent).toHaveBeenCalledWith(
      expect.anything(),
      "bank_transfer.rejected",
      expect.objectContaining({ customerId: "cus-1", reason: "Hesaba ulaşmadı", invoiceNumber: "F-2026-000007" }),
      { actorId: "admin-1" }
    );
    await expect(approveBankTransferNotice(id, "admin-1")).rejects.toThrow(/sonuçlandırılmış/);
  });
});

