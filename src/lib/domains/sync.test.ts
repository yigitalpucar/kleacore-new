import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  domainFindMany: vi.fn(),
  domainFindUnique: vi.fn(),
  domainUpdate: vi.fn(),
  eventCreate: vi.fn(),
  getDomainInfoFromRegistrar: vi.fn(),
  getRegistrarConfig: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    domain: { findMany: mocks.domainFindMany, findUnique: mocks.domainFindUnique, update: mocks.domainUpdate },
    domainLifecycleEvent: { create: mocks.eventCreate },
  },
}));
vi.mock("@/lib/integrations/registrar", () => ({ getDomainInfoFromRegistrar: mocks.getDomainInfoFromRegistrar }));
vi.mock("@/lib/integrations/registrar/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/integrations/registrar/config")>()),
  getRegistrarConfig: mocks.getRegistrarConfig,
}));

import { mapRegistrarStatus, reconcileDomain, syncDomainsWithRegistrar } from "./sync";

const local = {
  expiresAt: new Date("2026-11-07T00:00:00Z"),
  status: "ACTIVE" as const,
  nameservers: ["ns1.kleacore.com", "ns2.kleacore.com"],
};

describe("mapRegistrarStatus", () => {
  it.each([
    ["active", "ACTIVE"],
    ["clientTransferProhibited", "ACTIVE"],
    ["pending_transfer", "TRANSFERRING"],
    ["Transfer Pending", "TRANSFERRING"],
    ["expired", "EXPIRED"],
    ["redemptionPeriod", "EXPIRED"],
    ["something-new", null],
    ["", null],
    [null, null],
  ] as const)("%s → %s", (raw, expected) => {
    expect(mapRegistrarStatus(raw)).toBe(expected);
  });
});

describe("reconcileDomain", () => {
  it("never overwrites with empty or unknown registrar values", () => {
    const { data, diffs } = reconcileDomain(local, { domain: "ornek.com", expiresAt: null, status: "", nameservers: [] });
    expect(data).toEqual({});
    expect(diffs).toEqual([]);

    expect(reconcileDomain(local, { domain: "ornek.com", status: "weird-state" }).data).toEqual({});
  });

  it("ignores same-day expiry differences (time zone noise)", () => {
    const sameDay = new Date("2026-11-07T21:00:00Z");
    expect(reconcileDomain(local, { domain: "ornek.com", expiresAt: sameDay }).diffs).toEqual([]);
  });

  it("takes a moved expiry, a completed transfer and changed nameservers", () => {
    const newExpiry = new Date("2027-11-07T00:00:00Z");
    const { data, diffs } = reconcileDomain(
      { ...local, status: "TRANSFERRING" },
      { domain: "ornek.com", expiresAt: newExpiry, status: "active", nameservers: ["NS1.Example.com.", "ns2.example.com"] }
    );

    expect(data).toEqual({
      expiresAt: newExpiry,
      status: "ACTIVE",
      nameservers: ["ns1.example.com", "ns2.example.com"],
    });
    expect(diffs.map((d) => d.field)).toEqual(["expiresAt", "status", "nameservers"]);
  });
});

describe("syncDomainsWithRegistrar", () => {
  beforeEach(() => {
    mocks.domainUpdate.mockResolvedValue({});
    mocks.eventCreate.mockResolvedValue({});
  });

  it("no-ops with a clear summary when Gri isn't configured", async () => {
    mocks.getRegistrarConfig.mockResolvedValue({ enabled: true, provider: "gri", testMode: false });

    const result = await syncDomainsWithRegistrar();

    expect(result).toMatchObject({ processed: 0, registrar: "not-configured" });
    expect(mocks.domainFindMany).not.toHaveBeenCalled();
  });

  it("syncs in a batch with a delay between registrar calls and logs differences", async () => {
    mocks.getRegistrarConfig.mockResolvedValue({
      enabled: true,
      provider: "gri",
      username: "u",
      password: "p",
      clientId: "c",
      clientSecret: "s",
      testMode: false,
    });
    mocks.domainFindMany.mockResolvedValue([{ id: "dom-1" }, { id: "dom-2" }]);
    mocks.domainFindUnique.mockImplementation(({ where }: { where: { id: string } }) => ({
      id: where.id,
      name: `${where.id}.com`,
      ...local,
    }));
    mocks.getDomainInfoFromRegistrar
      .mockResolvedValueOnce({ ok: true, data: { domain: "dom-1.com", expiresAt: new Date("2027-11-07T00:00:00Z"), status: "active" } })
      .mockResolvedValueOnce({ ok: false, error: "GRI_REQUEST_TIMEOUT" });
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await syncDomainsWithRegistrar({ sleep, delayMs: 250, batchSize: 50 });

    expect(result).toMatchObject({ processed: 1, failed: 1, checked: 2, ids: ["dom-1"] });
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(250);
    expect(mocks.domainFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: { in: ["ACTIVE", "TRANSFERRING", "EXPIRED"] } }, take: 50 })
    );
    expect(mocks.domainUpdate).toHaveBeenCalledWith({
      where: { id: "dom-1" },
      data: { expiresAt: new Date("2027-11-07T00:00:00Z"), lastSyncedAt: expect.any(Date) },
    });
    expect(mocks.eventCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ domainId: "dom-1", type: "sync.updated" }) });
    expect(mocks.eventCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ domainId: "dom-2", type: "sync.failed" }) });
  });
});
