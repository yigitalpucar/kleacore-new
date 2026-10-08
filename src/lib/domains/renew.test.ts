import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  renewalFindUnique: vi.fn(),
  renewalFindFirst: vi.fn(),
  renewalUpdateMany: vi.fn(),
  renewalUpdate: vi.fn(),
  renewalCreate: vi.fn(),
  domainFindUnique: vi.fn(),
  domainUpdateMany: vi.fn(),
  eventCreate: vi.fn(),
  activityCreate: vi.fn(),
  userFindMany: vi.fn(),
  enqueue: vi.fn(),
  getBoss: vi.fn(),
  renewDomainWithRegistrar: vi.fn(),
  getDomainInfoFromRegistrar: vi.fn(),
  sendNotification: vi.fn(),
  emitEvent: vi.fn(),
  notificationCreateMany: vi.fn(),
  getAdminNotificationRecipients: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const client = {
    domainRenewal: {
      findUnique: mocks.renewalFindUnique,
      findFirst: mocks.renewalFindFirst,
      updateMany: mocks.renewalUpdateMany,
      update: mocks.renewalUpdate,
      create: mocks.renewalCreate,
    },
    domain: { findUnique: mocks.domainFindUnique, updateMany: mocks.domainUpdateMany },
    domainLifecycleEvent: { create: mocks.eventCreate },
    activityLog: { create: mocks.activityCreate },
    user: { findMany: mocks.userFindMany },
    notification: { createMany: mocks.notificationCreateMany },
    $transaction: (fn: (tx: unknown) => unknown) => fn(client),
  };
  return { db: client };
});
vi.mock("@/lib/jobs/enqueue", () => ({ enqueue: mocks.enqueue }));
vi.mock("@/lib/jobs/boss", () => ({ getBoss: mocks.getBoss }));
vi.mock("@/lib/integrations/registrar", () => ({
  renewDomainWithRegistrar: mocks.renewDomainWithRegistrar,
  getDomainInfoFromRegistrar: mocks.getDomainInfoFromRegistrar,
}));
vi.mock("@/lib/notifications/send", () => ({ sendNotification: mocks.sendNotification }));
vi.mock("@/lib/events/emit", () => ({ emitEvent: mocks.emitEvent }));
vi.mock("@/lib/provisioning/manual", () => ({
  getAdminNotificationRecipients: mocks.getAdminNotificationRecipients,
}));

import { db } from "@/lib/db";
import { manualRegistrarRenew, onDomainRenewalPaid, resolveNewExpiry, runDomainRenewal } from "./renew";

const periodStart = new Date("2026-11-07T07:00:00.000Z");
const oneYearLater = new Date("2027-11-07T07:00:00.000Z");

function renewal(overrides: Record<string, unknown> = {}) {
  return {
    id: "ren-1",
    domainId: "dom-1",
    invoiceId: "inv-1",
    periodStart,
    years: 1,
    status: "PAID",
    source: "cron",
    attempts: 0,
    lastError: null,
    newExpiresAt: null,
    renewedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    domain: { id: "dom-1", name: "ornek.com", customerId: "cust-1", expiresAt: periodStart, status: "ACTIVE" },
    ...overrides,
  };
}

const context = (isFinalAttempt = false) => ({ jobId: "job-1", retryCount: 0, retryLimit: 4, isFinalAttempt });

beforeEach(() => {
  mocks.getBoss.mockResolvedValue({ findJobs: vi.fn().mockResolvedValue([]), deleteJob: vi.fn() });
  mocks.enqueue.mockResolvedValue({ id: "job-1", deduplicated: false });
  mocks.renewalUpdateMany.mockResolvedValue({ count: 1 });
  mocks.renewalUpdate.mockResolvedValue({});
  mocks.domainUpdateMany.mockResolvedValue({ count: 1 });
  mocks.eventCreate.mockResolvedValue({});
  mocks.activityCreate.mockResolvedValue({});
  mocks.sendNotification.mockResolvedValue({ ok: true, logIds: ["log-1"], deduplicated: false });
  mocks.notificationCreateMany.mockResolvedValue({ count: 2 });
  mocks.getAdminNotificationRecipients.mockResolvedValue({ email: "ops@kleacore.test" });
  mocks.userFindMany.mockResolvedValue([{ id: "admin-1" }, { id: "admin-2" }]);
  mocks.getDomainInfoFromRegistrar.mockResolvedValue({ ok: false, skipped: true });
});

describe("onDomainRenewalPaid", () => {
  it("is a no-op for invoices that are not domain renewals", async () => {
    mocks.renewalFindUnique.mockResolvedValue(null);

    expect(await onDomainRenewalPaid("inv-x")).toEqual({ queued: false, renewalId: null });
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it("marks the renewal PAID and enqueues domain.renew in the payment transaction", async () => {
    mocks.renewalFindUnique.mockResolvedValue({ id: "ren-1", domainId: "dom-1", years: 1 });
    const tx = db as never;

    const result = await onDomainRenewalPaid("inv-1", tx);

    expect(result).toEqual({ queued: true, renewalId: "ren-1" });
    expect(mocks.renewalUpdateMany).toHaveBeenCalledWith({
      where: { id: "ren-1", status: { in: ["PENDING", "CANCELLED"] } },
      data: { status: "PAID", lastError: null },
    });
    expect(mocks.enqueue).toHaveBeenCalledWith("domain.renew", { renewalId: "ren-1" }, { singletonKey: "ren-1", tx });
  });

  it("does not enqueue twice for an already paid renewal", async () => {
    mocks.renewalFindUnique.mockResolvedValue({ id: "ren-1", domainId: "dom-1", years: 1 });
    mocks.renewalUpdateMany.mockResolvedValue({ count: 0 });

    expect(await onDomainRenewalPaid("inv-1")).toEqual({ queued: false, renewalId: "ren-1" });
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
});

describe("runDomainRenewal", () => {
  it("renews at the registrar and moves expiresAt one year forward", async () => {
    mocks.renewalFindUnique.mockResolvedValue(renewal());
    mocks.renewDomainWithRegistrar.mockResolvedValue({ ok: true, provider: "gri", data: { expiresAt: null } });

    const result = await runDomainRenewal("ren-1", context());

    expect(mocks.renewDomainWithRegistrar).toHaveBeenCalledWith({ domain: "ornek.com", years: 1 });
    expect(result).toEqual({ ok: true, renewalId: "ren-1", newExpiresAt: oneYearLater });
    expect(mocks.domainUpdateMany).toHaveBeenCalledWith({
      where: { id: "dom-1", expiresAt: { lt: oneYearLater } },
      data: { expiresAt: oneYearLater },
    });
    expect(mocks.renewalUpdate).toHaveBeenCalledWith({
      where: { id: "ren-1" },
      data: expect.objectContaining({ status: "COMPLETED", newExpiresAt: oneYearLater }),
    });
    expect(mocks.activityCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "cust-1", action: "domain.renewed", entityId: "dom-1" }),
    });
    expect(mocks.emitEvent).toHaveBeenCalledWith(
      expect.anything(),
      "domain.renewed",
      expect.objectContaining({ domainId: "dom-1", renewalId: "ren-1", customerId: "cust-1", expiresAt: oneYearLater }),
      expect.anything()
    );
  });

  it("prefers the expiry reported by the registrar", async () => {
    const reported = new Date("2027-11-08T00:00:00.000Z");
    mocks.renewalFindUnique.mockResolvedValue(renewal());
    mocks.renewDomainWithRegistrar.mockResolvedValue({ ok: true, data: { expiresAt: reported } });

    expect(await runDomainRenewal("ren-1", context())).toMatchObject({ newExpiresAt: reported });
  });

  it("never renews an unpaid renewal", async () => {
    mocks.renewalFindUnique.mockResolvedValue(renewal({ status: "PENDING" }));

    expect(await runDomainRenewal("ren-1", context())).toEqual({ skipped: "NOT_PAID", renewalId: "ren-1" });
    expect(mocks.renewDomainWithRegistrar).not.toHaveBeenCalled();
  });

  it("throws (so pg-boss retries) and keeps the renewal PAID on a non-final failure", async () => {
    mocks.renewalFindUnique.mockResolvedValue(renewal());
    mocks.renewDomainWithRegistrar.mockResolvedValue({ ok: false, error: "GRI_TIMEOUT" });

    await expect(runDomainRenewal("ren-1", context(false))).rejects.toThrow("GRI_TIMEOUT");
    expect(mocks.renewalUpdate).toHaveBeenCalledWith({
      where: { id: "ren-1" },
      data: { status: "PAID", attempts: { increment: 1 }, lastError: "GRI_TIMEOUT" },
    });
    expect(mocks.userFindMany).not.toHaveBeenCalled();
  });

  it("treats a disabled registrar as a failure, and on the final attempt marks FAILED and notifies admins", async () => {
    mocks.renewalFindUnique.mockResolvedValue(renewal({ attempts: 4 }));
    mocks.renewDomainWithRegistrar.mockResolvedValue({ ok: false, skipped: true, error: "REGISTRAR_NOT_CONFIGURED" });

    await expect(runDomainRenewal("ren-1", context(true))).rejects.toThrow("REGISTRAR_NOT_CONFIGURED");
    expect(mocks.renewalUpdate).toHaveBeenCalledWith({
      where: { id: "ren-1" },
      data: expect.objectContaining({ status: "FAILED" }),
    });
    // In-app notice for both admins + one staff e-mail, deduped per renewal.
    expect(mocks.notificationCreateMany.mock.calls[0][0].data).toHaveLength(2);
    expect(mocks.sendNotification).toHaveBeenCalledTimes(1);
    expect(mocks.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "admin.domain-renewal-failed",
        to: "ops@kleacore.test",
        dedupeKey: "domain.renewal-failed:ren-1",
      })
    );
    expect(mocks.domainUpdateMany).not.toHaveBeenCalled();
  });

  it("does not renew twice when a retry finds the registrar already renewed", async () => {
    mocks.renewalFindUnique.mockResolvedValue(renewal({ attempts: 1 }));
    mocks.getDomainInfoFromRegistrar.mockResolvedValue({ ok: true, data: { domain: "ornek.com", expiresAt: oneYearLater } });

    const result = await runDomainRenewal("ren-1", context());

    expect(mocks.renewDomainWithRegistrar).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, newExpiresAt: oneYearLater });
  });

  it("throws RENEWAL_BUSY when another run holds the renewal", async () => {
    mocks.renewalFindUnique.mockResolvedValue(renewal({ status: "PROCESSING" }));
    mocks.renewalUpdateMany.mockResolvedValue({ count: 0 });

    await expect(runDomainRenewal("ren-1", context())).rejects.toThrow("RENEWAL_BUSY");
    expect(mocks.renewDomainWithRegistrar).not.toHaveBeenCalled();
  });
});

describe("manualRegistrarRenew", () => {
  it("refuses while the period has an unpaid renewal invoice", async () => {
    mocks.domainFindUnique.mockResolvedValue({ id: "dom-1", name: "ornek.com", expiresAt: periodStart });
    mocks.renewalFindFirst.mockResolvedValue(null);
    mocks.renewalFindUnique.mockResolvedValue({ id: "ren-1", status: "PENDING", invoice: { status: "PENDING", invoiceNumber: "F-1" } });

    expect(await manualRegistrarRenew("dom-1", "admin-1")).toEqual({ ok: false, error: "OPEN_INVOICE:F-1" });
    expect(mocks.renewDomainWithRegistrar).not.toHaveBeenCalled();
  });
});

describe("resolveNewExpiry", () => {
  it("ignores a registrar date that is not after the period start", () => {
    expect(resolveNewExpiry(periodStart, 2, new Date("2020-01-01"))).toEqual(new Date("2028-11-07T07:00:00.000Z"));
  });
});
