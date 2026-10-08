import { describe, expect, it } from "vitest";
import {
  addMonths,
  buildProposal,
  isProposalReady,
  mapDomainStatus,
  matchAccountProduct,
  matchCustomer,
  matchVirtualMachineProduct,
  proposeNextDueDate,
  resolveServiceAmount,
  type MatchContext,
  type ProductCandidate,
} from "./mapping";
import { summarizePreview } from "./preview";
import type { ImportedAccount, ImportedDomain, ImportedVirtualMachine } from "./types";

const NOW = new Date("2026-10-08T09:00:00Z");
const INSTANCE = "inst_whm";

const ayse = { id: "u_ayse", email: "ayse@musteri.test", label: "Ayşe Yılmaz" };
const mehmet = { id: "u_mehmet", email: "mehmet@firma.test", label: "Firma A.Ş." };

function product(overrides: Partial<ProductCandidate>): ProductCandidate {
  return {
    id: "p",
    name: "Ürün",
    sku: "SKU",
    categorySlug: "hosting",
    moduleInstanceId: null,
    moduleOptions: {},
    basePrice: 100,
    pricingTiers: [
      { period: "monthly", price: 49, isDefault: false },
      { period: "yearly", price: 39, isDefault: true },
    ],
    ...overrides,
  };
}

const products: ProductCandidate[] = [
  product({ id: "p_start", name: "Başlangıç", sku: "HOST-START", moduleOptions: { package: "kleacore_Baslangic" } }),
  product({ id: "p_pro_other", name: "Pro (başka sunucu)", sku: "HOST-PRO-2", moduleOptions: { package: "Pro" }, moduleInstanceId: "inst_other" }),
  product({ id: "p_pro", name: "Pro", sku: "HOST-PRO", moduleOptions: { package: "Pro" }, moduleInstanceId: INSTANCE }),
  product({ id: "p_legacy", name: "Eski", sku: "eski_paket" }),
  product({ id: "p_vds2", name: "VDS 2", sku: "VDS-2", categorySlug: "vds", moduleOptions: { cores: 2, memoryMB: 4096 }, pricingTiers: [{ period: "monthly", price: 300, isDefault: true }] }),
  product({ id: "p_vds4", name: "VDS 4", sku: "VDS-4", categorySlug: "vds", moduleOptions: { cores: "4", memoryMB: "8192" } }),
];

function ctx(overrides: Partial<MatchContext> = {}): MatchContext {
  return {
    now: NOW,
    instanceId: INSTANCE,
    customersByEmail: new Map([
      [ayse.email, ayse],
      [mehmet.email, mehmet],
    ]),
    customersByDomain: new Map([["firma.test", mehmet]]),
    products,
    importedServices: new Map(),
    legacyServices: [],
    existingDomains: new Map(),
    ...overrides,
  };
}

function account(overrides: Partial<ImportedAccount> = {}): ImportedAccount {
  return {
    kind: "account",
    remoteId: "ornekweb",
    username: "ornekweb",
    domain: "ornek-web.test",
    email: "Ayse@Musteri.test ",
    plan: "kleacore_Baslangic",
    diskUsedMB: 150,
    diskLimitMB: 5120,
    suspended: false,
    suspendReason: null,
    createdAt: "2024-01-15T10:00:00.000Z",
    ipAddresses: ["192.0.2.10"],
    ...overrides,
  };
}

function vm(overrides: Partial<ImportedVirtualMachine> = {}): ImportedVirtualMachine {
  return {
    kind: "vm",
    remoteId: "101",
    name: "vds-musteri",
    node: "pve1",
    status: "running",
    cores: 2,
    memoryMB: 4096,
    diskGB: 40,
    ipAddresses: ["203.0.113.40"],
    createdAt: null,
    ...overrides,
  };
}

function domain(overrides: Partial<ImportedDomain> = {}): ImportedDomain {
  return {
    kind: "domain",
    remoteId: "firma.test",
    name: "firma.test",
    expiresAt: "2027-02-01T00:00:00.000Z",
    status: "active",
    nameservers: ["ns1.kleacore.com"],
    autoRenew: false,
    ...overrides,
  };
}

describe("customer matching", () => {
  it("matches by e-mail exactly, case- and whitespace-insensitive", () => {
    expect(matchCustomer(account(), ctx())).toEqual({ mode: "existing", userId: "u_ayse", email: ayse.email, label: ayse.label, matchedBy: "email" });
  });

  it("falls back to a known domain (also the parent of a subdomain / VM hostname)", () => {
    expect(matchCustomer(account({ email: "baska@x.test", domain: "firma.test" }), ctx())).toMatchObject({ userId: "u_mehmet", matchedBy: "domain" });
    expect(matchCustomer(account({ email: null, domain: "magaza.firma.test" }), ctx())).toMatchObject({ userId: "u_mehmet", matchedBy: "domain" });
    expect(matchCustomer(vm({ name: "vds1.firma.test" }), ctx())).toMatchObject({ userId: "u_mehmet", matchedBy: "domain" });
    expect(matchCustomer(domain(), ctx())).toMatchObject({ userId: "u_mehmet", matchedBy: "domain" });
  });

  it("e-mail wins over domain", () => {
    expect(matchCustomer(account({ domain: "firma.test" }), ctx())).toMatchObject({ userId: "u_ayse", matchedBy: "email" });
  });

  it("proposes a new customer from an unknown e-mail, none without one", () => {
    expect(matchCustomer(account({ email: "ali.veli@yeni.test", domain: "yeni.test" }), ctx())).toEqual({
      mode: "new",
      email: "ali.veli@yeni.test",
      name: "Ali",
      surname: "Veli",
    });
    expect(matchCustomer(account({ email: null, domain: "bilinmeyen.test" }), ctx())).toEqual({ mode: "none" });
    expect(matchCustomer(vm(), ctx())).toEqual({ mode: "none" });
  });
});

describe("product matching", () => {
  it("WHM plan → moduleOptions.package, preferring products bound to this instance", () => {
    expect(matchAccountProduct(account(), ctx())).toEqual({ productId: "p_start", matchedBy: "package" });
    expect(matchAccountProduct(account({ plan: "Pro" }), ctx())).toEqual({ productId: "p_pro", matchedBy: "package" });
  });

  it("handles the reseller prefix and falls back to the SKU (legacy package = SKU)", () => {
    expect(matchAccountProduct(account({ plan: "kleacore_pro" }), ctx())).toEqual({ productId: "p_pro", matchedBy: "package" });
    expect(matchAccountProduct(account({ plan: "kleacore_eski_paket" }), ctx())).toEqual({ productId: "p_legacy", matchedBy: "sku" });
    expect(matchAccountProduct(account({ plan: "bilinmeyen" }), ctx())).toEqual({ productId: null, matchedBy: null });
  });

  it("VM → product with the same cores and memory", () => {
    expect(matchVirtualMachineProduct(vm(), ctx())).toEqual({ productId: "p_vds2", matchedBy: "resources" });
    expect(matchVirtualMachineProduct(vm({ cores: 4, memoryMB: 8192 }), ctx())).toEqual({ productId: "p_vds4", matchedBy: "resources" });
    expect(matchVirtualMachineProduct(vm({ cores: 3 }), ctx())).toEqual({ productId: null, matchedBy: null });
  });
});

describe("billing and status", () => {
  it("next due date is the creation anniversary on or after today, never in the past", () => {
    expect(proposeNextDueDate(new Date("2024-01-15T10:00:00Z"), "yearly", NOW).toISOString().slice(0, 10)).toBe("2027-01-15");
    expect(proposeNextDueDate(new Date("2024-01-31T00:00:00Z"), "monthly", NOW).toISOString().slice(0, 10)).toBe("2026-10-31");
    expect(proposeNextDueDate(new Date("2026-10-08T00:00:00Z"), "monthly", NOW).toISOString().slice(0, 10)).toBe("2026-11-08");
    expect(proposeNextDueDate(null, "quarterly", NOW).toISOString().slice(0, 10)).toBe("2027-01-08");
    expect(addMonths(new Date("2026-01-31T00:00:00Z"), 1).toISOString().slice(0, 10)).toBe("2026-02-28");
  });

  it("amount = catalogue price for the period (monthly-equivalent × months), or the override", () => {
    expect(resolveServiceAmount(products[0], "yearly", null)).toBe("468.00");
    expect(resolveServiceAmount(products[0], "monthly", null)).toBe("49.00");
    expect(resolveServiceAmount(products[0], "yearly", "399,90")).toBe("399.90");
    expect(() => resolveServiceAmount(products[0], "yearly", "abc")).toThrow(/Fiyat/);
  });

  it("suspended WHM account → SUSPENDED proposal with a note", () => {
    const proposal = buildProposal(account({ suspended: true, suspendReason: "Ödeme gecikti" }), ctx());
    expect(proposal.serviceStatus).toBe("SUSPENDED");
    expect(proposal.notes.join(" ")).toMatch(/askıda: Ödeme gecikti/);
    expect(buildProposal(vm({ status: "stopped" }), ctx()).serviceStatus).toBe("ACTIVE");
  });

  it("domain status: registrar text, and a past expiry is EXPIRED", () => {
    expect(mapDomainStatus(domain(), NOW)).toBe("ACTIVE");
    expect(mapDomainStatus(domain({ status: "transfer_pending" }), NOW)).toBe("TRANSFERRING");
    expect(mapDomainStatus(domain({ status: "active", expiresAt: "2026-09-01T00:00:00Z" }), NOW)).toBe("EXPIRED");
  });
});

describe("proposal", () => {
  it("a fully matched WHM account is ready", () => {
    const proposal = buildProposal(account(), ctx());
    expect(proposal).toMatchObject({
      action: "import",
      productId: "p_start",
      productMatchedBy: "package",
      billingPeriod: "yearly",
      nextDueDate: "2027-01-15",
      serviceStatus: "ACTIVE",
      existingId: null,
    });
    expect(isProposalReady(account(), proposal)).toBe(true);
  });

  it("already imported remote ids are skipped (idempotent preview)", () => {
    const proposal = buildProposal(account(), ctx({ importedServices: new Map([["ornekweb", "svc_1"]]) }));
    expect(proposal).toMatchObject({ action: "skip", existingId: "svc_1" });
    expect(isProposalReady(account(), proposal)).toBe(false);
    expect(buildProposal(domain(), ctx({ existingDomains: new Map([["firma.test", "dom_1"]]) }))).toMatchObject({ action: "skip", existingId: "dom_1" });
  });

  it("a legacy service with the WHM username is proposed for linking instead of a duplicate", () => {
    const proposal = buildProposal(
      account(),
      ctx({ legacyServices: [{ id: "svc_old", customerId: "u_ayse", username: "OrnekWeb", serverName: null, domain: null }] })
    );
    expect(proposal).toMatchObject({ action: "link", linkServiceId: "svc_old" });
    expect(isProposalReady(account(), proposal)).toBe(true);
  });

  it("missing product or customer is not ready", () => {
    expect(isProposalReady(account({ plan: "yok" }), buildProposal(account({ plan: "yok" }), ctx()))).toBe(false);
    const noCustomer = account({ email: null, domain: "bilinmeyen.test" });
    expect(isProposalReady(noCustomer, buildProposal(noCustomer, ctx()))).toBe(false);
  });

  it("domains take the registrar expiry and auto-renew flag", () => {
    expect(buildProposal(domain(), ctx())).toMatchObject({ nextDueDate: "2027-02-01", autoRenew: false, domainStatus: "ACTIVE" });
    expect(buildProposal(domain({ expiresAt: null }), ctx()).notes.join(" ")).toMatch(/Bitiş tarihi/);
  });

  it("summarizes a preview for the CLI", () => {
    const summary = summarizePreview(
      [account(), account({ remoteId: "x", username: "x", email: "yeni@yeni.test", domain: "yeni.test", plan: "yok" }), account({ remoteId: "s", username: "s", suspended: true })],
      ctx()
    );
    expect(summary).toMatchObject({
      total: 3,
      ready: 2,
      needsAttention: 1,
      suspended: 1,
      customers: { byEmail: 2, byDomain: 0, new: 1, none: 0 },
      products: { matched: 2, unmatched: 1 },
    });
  });
});
