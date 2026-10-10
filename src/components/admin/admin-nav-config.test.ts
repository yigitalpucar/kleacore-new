import { describe, expect, it } from "vitest";
import {
  adminGroupShortcuts,
  adminQuickActions,
  adminSearchItems,
  buildAdminNav,
  findAdminSection,
  type AdminCounts,
} from "./admin-nav-config";

const counts: AdminCounts = {
  pendingOrders: 1,
  openTickets: 2,
  overdueInvoices: 3,
  pendingCancellations: 0,
  pendingManualProvisioning: 0,
  pendingBankTransfers: 4,
};

const hrefs = (role: Parameters<typeof buildAdminNav>[1]) =>
  buildAdminNav(counts, role).flatMap((g) => g.items.map((i) => i.href));

describe("admin nav filtering", () => {
  it("shows everything to ADMIN, including Personel", () => {
    const nav = hrefs("ADMIN");
    expect(nav).toContain("/yonetim/faturalar");
    expect(nav).toContain("/yonetim/ayarlar");
    expect(nav).toContain("/yonetim/personel");
  });

  it("SUPPORT sees tickets, customers, services, domains, activity, KYC, KVKK — no billing or system pages", () => {
    expect(hrefs("SUPPORT").sort()).toEqual(
      [
        "/yonetim",
        "/yonetim/musteriler",
        "/yonetim/bayiler",
        "/yonetim/hizmetler",
        "/yonetim/domainler",
        "/yonetim/destek",
        "/yonetim/aktivite",
        "/yonetim/api-tokenlari",
        "/yonetim/kyc",
        "/yonetim/kvkk-talepleri",
      ].sort()
    );
  });

  it("BILLING sees invoices, e-fatura, reports, orders, customers", () => {
    const nav = hrefs("BILLING");
    for (const href of ["/yonetim/faturalar", "/yonetim/efatura", "/yonetim/raporlar", "/yonetim/siparisler", "/yonetim/musteriler"]) {
      expect(nav).toContain(href);
    }
    for (const href of ["/yonetim/destek", "/yonetim/ayarlar", "/yonetim/personel", "/yonetim/urunler", "/yonetim/hizmetler", "/yonetim/kyc", "/yonetim/kvkk-talepleri"]) {
      expect(nav).not.toContain(href);
    }
  });

  it("drops groups that end up empty", () => {
    const groups = buildAdminNav(counts, "SUPPORT");
    expect(groups.every((g) => g.items.length > 0)).toBe(true);
    expect(groups.map((g) => g.label)).not.toContain("Katalog");
  });

  it("filters section tabs and the command palette", () => {
    expect(findAdminSection("/yonetim/musteri-ekle", "SUPPORT")).toBeUndefined();
    const musteriler = findAdminSection("/yonetim/musteriler", "SUPPORT");
    expect(musteriler?.tabs.map((t) => t.href)).not.toContain("/yonetim/musteri-ekle");

    const billingInvoices = findAdminSection("/yonetim/faturalar", "BILLING");
    expect(billingInvoices?.tabs.map((t) => t.href)).toContain("/yonetim/faturalar/olustur");

    const search = adminSearchItems(buildAdminNav(counts, "SUPPORT"), "SUPPORT").map((i) => i.href);
    expect(search.some((h) => h.startsWith("/yonetim/faturalar"))).toBe(false);
    expect(search.some((h) => h.startsWith("/yonetim/urunler"))).toBe(false);
  });

  it("folds every labelled group and keeps each mega menu panel short", () => {
    const groups = buildAdminNav(counts, "ADMIN");
    expect(groups[0].label).toBeUndefined();
    for (const group of groups.slice(1)) {
      expect(group.label).toBeTruthy();
      expect(group.collapsible).toBe(true);
      expect(group.items.length).toBeLessThanOrEqual(7);
    }
    const hrefsInNav = groups.flatMap((g) => g.items.map((i) => i.href));
    expect(new Set(hrefsInNav).size).toBe(hrefsInNav.length);
  });

  it("puts overdue invoices and bank transfer notices on the Faturalar badge", () => {
    const faturalar = buildAdminNav(counts, "ADMIN")
      .flatMap((g) => g.items)
      .find((i) => i.href === "/yonetim/faturalar");
    expect(faturalar?.badge).toBe(7);
  });
});

describe("admin top bar", () => {
  it("lists only the quick actions a role can open", () => {
    const support = adminQuickActions(counts, "SUPPORT");
    expect(support.create.map((a) => a.href)).not.toContain("/yonetim/faturalar/olustur");
    expect(support.queues.map((q) => q.href)).toContain("/yonetim/destek");
    expect(support.queues.map((q) => q.href)).not.toContain("/yonetim/faturalar/havale-bildirimleri");

    const admin = adminQuickActions(counts, "ADMIN");
    expect(admin.queues.find((q) => q.href === "/yonetim/faturalar/havale-bildirimleri")?.count).toBe(4);
  });

  it("gives mega menu shortcuts from section tabs without repeating group pages", () => {
    const finans = buildAdminNav(counts, "ADMIN").find((g) => g.label === "Finans")!;
    const shortcuts = adminGroupShortcuts(finans, "ADMIN").map((t) => t.href);
    expect(shortcuts).toContain("/yonetim/faturalar/gecikmis");
    expect(shortcuts).not.toContain("/yonetim/faturalar");
    expect(shortcuts.length).toBeLessThanOrEqual(8);
  });
});
