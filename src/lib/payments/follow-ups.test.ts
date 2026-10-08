import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  issueEInvoiceForInvoice: vi.fn(),
  isJobQueueReady: vi.fn(),
  enqueue: vi.fn(),
}));

vi.mock("@/lib/integrations/efatura", () => ({ issueEInvoiceForInvoice: mocks.issueEInvoiceForInvoice }));
vi.mock("@/lib/provisioning/queue", () => ({ isJobQueueReady: mocks.isJobQueueReady }));
vi.mock("@/lib/jobs/enqueue", () => ({ enqueue: mocks.enqueue }));

import type { Prisma } from "@prisma/client";
import { queuePaymentFollowUps, runEInvoiceIssueJob, withSavepoint } from "./follow-ups";

function fakeTx() {
  const sql: string[] = [];
  return {
    sql,
    tx: { $executeRawUnsafe: vi.fn(async (statement: string) => sql.push(statement)) } as unknown as Prisma.TransactionClient,
  };
}

describe("withSavepoint", () => {
  it("rolls back only to the savepoint and reports the error", async () => {
    const { sql, tx } = fakeTx();
    const result = await withSavepoint(tx, async () => {
      throw new Error("boom");
    });
    expect(result).toMatchObject({ ok: false });
    expect(sql[0]).toMatch(/^SAVEPOINT kc_sp_\d+$/);
    expect(sql[1]).toMatch(/^ROLLBACK TO SAVEPOINT kc_sp_\d+$/);
  });
});

describe("queuePaymentFollowUps", () => {
  beforeEach(() => Object.values(mocks).forEach((mock) => mock.mockReset()));

  it("enqueues e-invoice and payment.settled with the payment transaction, once per invoice", async () => {
    const { tx } = fakeTx();
    mocks.isJobQueueReady.mockResolvedValue(true);
    mocks.enqueue.mockResolvedValue({ id: "j", deduplicated: false });

    await expect(queuePaymentFollowUps(tx, { invoiceId: "inv-1", userId: "u", events: [] })).resolves.toBe(true);
    expect(mocks.enqueue).toHaveBeenCalledWith("efatura.issue", { invoiceId: "inv-1" }, { singletonKey: "inv-1", tx });
    expect(mocks.enqueue).toHaveBeenCalledWith(
      "payment.settled",
      { invoiceId: "inv-1", userId: "u", events: [] },
      { singletonKey: "inv-1", tx }
    );
  });

  it("never fails the payment when the queue is down", async () => {
    const { tx } = fakeTx();
    mocks.isJobQueueReady.mockResolvedValue(true);
    mocks.enqueue.mockRejectedValue(new Error("pgboss down"));
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(queuePaymentFollowUps(tx, { invoiceId: "inv-1", userId: "u", events: [] })).resolves.toBe(false);
    error.mockRestore();
  });
});

describe("runEInvoiceIssueJob (efatura.issue)", () => {
  beforeEach(() => Object.values(mocks).forEach((mock) => mock.mockReset()));

  it("retries entegratör errors but not bad invoice data", async () => {
    mocks.issueEInvoiceForInvoice.mockResolvedValueOnce({ ok: false, error: "UYUMSOFT_HTTP_503" });
    await expect(runEInvoiceIssueJob("inv-1")).rejects.toThrow("UYUMSOFT_HTTP_503");

    mocks.issueEInvoiceForInvoice.mockResolvedValueOnce({
      ok: false,
      error: "EFATURA_LINES_MISMATCH: kalemler toplamı 120,00 ≠ ara toplam 100,00",
    });
    await expect(runEInvoiceIssueJob("inv-1")).resolves.toMatchObject({ ok: false });

    mocks.issueEInvoiceForInvoice.mockResolvedValueOnce({ ok: false, skipped: true, reason: "EFATURA_DISABLED" });
    await expect(runEInvoiceIssueJob("inv-1")).resolves.toEqual({ ok: false, skipped: "EFATURA_DISABLED" });
  });
});
