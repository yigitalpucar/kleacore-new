import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  domainFindUnique: vi.fn(),
  domainUpdate: vi.fn(),
  eventCreate: vi.fn(),
  createDomainRenewalInvoice: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    domain: { findUnique: mocks.domainFindUnique, update: mocks.domainUpdate },
    domainLifecycleEvent: { create: mocks.eventCreate },
  },
}));
vi.mock("./renewal-invoices", () => ({ createDomainRenewalInvoice: mocks.createDomainRenewalInvoice }));

import { requestRenewalForCustomer, setAutoRenewForCustomer } from "./self-service";

const domain = {
  id: "dom-1",
  name: "ornek.com",
  customerId: "cust-1",
  expiresAt: new Date("2026-11-07T00:00:00Z"),
  status: "ACTIVE",
  autoRenew: true,
};

beforeEach(() => {
  mocks.domainFindUnique.mockResolvedValue(domain);
  mocks.eventCreate.mockResolvedValue({});
});

describe("setAutoRenewForCustomer", () => {
  it("persists the toggle and records who changed it", async () => {
    expect(await setAutoRenewForCustomer("dom-1", "cust-1", false)).toEqual({ success: true, autoRenew: false });
    expect(mocks.domainUpdate).toHaveBeenCalledWith({ where: { id: "dom-1" }, data: { autoRenew: false } });
    expect(mocks.eventCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: "auto_renew.changed", actorId: "cust-1" }),
    });
  });

  it("rejects another customer's domain", async () => {
    expect(await setAutoRenewForCustomer("dom-1", "intruder", false)).toEqual({ success: false, error: "Alan adı bulunamadı" });
    expect(mocks.domainUpdate).not.toHaveBeenCalled();
  });
});

describe("requestRenewalForCustomer", () => {
  it("returns the current period's renewal invoice (reissuing a cancelled one)", async () => {
    mocks.createDomainRenewalInvoice.mockResolvedValue({ status: "existing", invoiceId: "inv-1", renewalId: "ren-1" });

    expect(await requestRenewalForCustomer("dom-1", "cust-1")).toEqual({ success: true, invoiceId: "inv-1", created: false });
    expect(mocks.createDomainRenewalInvoice).toHaveBeenCalledWith(domain, {
      source: "customer",
      reopenCancelled: true,
      actorId: "cust-1",
    });
  });

  it("refuses domains that are transferring", async () => {
    mocks.domainFindUnique.mockResolvedValue({ ...domain, status: "TRANSFERRING" });

    expect(await requestRenewalForCustomer("dom-1", "cust-1")).toMatchObject({ success: false });
    expect(mocks.createDomainRenewalInvoice).not.toHaveBeenCalled();
  });

  it("explains a renewal that is already paid", async () => {
    mocks.createDomainRenewalInvoice.mockResolvedValue({ status: "skipped", reason: "RENEWAL_IN_PROGRESS" });

    expect(await requestRenewalForCustomer("dom-1", "cust-1")).toEqual({
      success: false,
      error: "Bu dönemin yenilemesi zaten ödendi ve işleniyor.",
    });
  });
});
