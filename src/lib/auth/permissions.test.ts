import { describe, expect, it } from "vitest";
import {
  ADMIN_ROUTE_PERMISSIONS,
  PERMISSIONS,
  canAccessRoute,
  hasAnyPermission,
  hasPermission,
  isStaffRole,
  permissionsForRole,
  routePermissions,
} from "./permissions";

describe("permission matrix", () => {
  it("gives ADMIN every permission", () => {
    for (const p of PERMISSIONS) expect(hasPermission("ADMIN", p)).toBe(true);
    expect(permissionsForRole("ADMIN")).toEqual(PERMISSIONS);
  });

  it("SUPPORT: tickets + read-only customers/services/domains + own activity", () => {
    expect([...permissionsForRole("SUPPORT")].sort()).toEqual(
      ["activity.view_own", "api_tokens.manage", "customers.view", "domains.view", "services.view", "tickets.reply", "tickets.view"].sort()
    );
    expect(hasPermission("SUPPORT", "invoices.view")).toBe(false);
    expect(hasPermission("SUPPORT", "customers.edit")).toBe(false);
    expect(hasPermission("SUPPORT", "activity.view")).toBe(false);
    expect(hasPermission("SUPPORT", "staff.manage")).toBe(false);
  });

  it("BILLING: invoices, refunds, bank transfers, e-fatura, reports, read-only customers/orders", () => {
    expect([...permissionsForRole("BILLING")].sort()).toEqual(
      [
        "bank_transfers.approve",
        "customers.view",
        "efatura.manage",
        "invoices.edit",
        "invoices.view",
        "orders.view",
        "payments.refund",
        "reports.view",
        "api_tokens.manage",
      ].sort()
    );
    expect(hasPermission("BILLING", "tickets.view")).toBe(false);
    expect(hasPermission("BILLING", "orders.manage")).toBe(false);
    expect(hasPermission("BILLING", "settings.manage")).toBe(false);
  });

  it("gives customers and unknown roles nothing", () => {
    for (const role of ["CUSTOMER", undefined, null, "", "admin", "SUPERADMIN"]) {
      expect(isStaffRole(role)).toBe(false);
      expect(permissionsForRole(role)).toEqual([]);
      expect(hasPermission(role, "tickets.view")).toBe(false);
    }
  });

  it("hasAnyPermission needs at least one", () => {
    expect(hasAnyPermission("SUPPORT", ["activity.view", "activity.view_own"])).toBe(true);
    expect(hasAnyPermission("BILLING", ["activity.view", "activity.view_own"])).toBe(false);
  });

  it("only maps routes to known permissions", () => {
    for (const perms of Object.values(ADMIN_ROUTE_PERMISSIONS)) {
      for (const p of perms ?? []) expect(PERMISSIONS).toContain(p);
    }
  });
});

describe("route permissions", () => {
  it("uses the longest matching prefix", () => {
    expect(routePermissions("/yonetim/faturalar/olustur")).toEqual(["invoices.edit"]);
    expect(routePermissions("/yonetim/faturalar/abc123")).toEqual(["invoices.view"]);
    expect(routePermissions("/yonetim/faturalar/havale-bildirimleri?x=1")).toEqual(["invoices.view"]);
    expect(routePermissions("/yonetim")).toBeNull();
    expect(routePermissions("/yonetim/")).toBeNull();
  });

  it("treats unmapped /yonetim routes as ADMIN-only", () => {
    expect(routePermissions("/yonetim/yeni-bir-sayfa")).toBeUndefined();
    expect(canAccessRoute("ADMIN", "/yonetim/yeni-bir-sayfa")).toBe(true);
    expect(canAccessRoute("SUPPORT", "/yonetim/yeni-bir-sayfa")).toBe(false);
  });

  it("does not match a prefix inside a segment", () => {
    expect(routePermissions("/yonetim/destekler")).toBeUndefined();
  });

  it("SUPPORT gets 403 on invoices, reaches tickets", () => {
    expect(canAccessRoute("SUPPORT", "/yonetim/faturalar")).toBe(false);
    expect(canAccessRoute("SUPPORT", "/yonetim/destek/t1")).toBe(true);
    expect(canAccessRoute("SUPPORT", "/yonetim/aktivite")).toBe(true);
    expect(canAccessRoute("SUPPORT", "/yonetim")).toBe(true);
  });

  it("BILLING reaches invoices and reports, not tickets or staff", () => {
    expect(canAccessRoute("BILLING", "/yonetim/faturalar/olustur")).toBe(true);
    expect(canAccessRoute("BILLING", "/yonetim/raporlar")).toBe(true);
    expect(canAccessRoute("BILLING", "/yonetim/destek")).toBe(false);
    expect(canAccessRoute("BILLING", "/yonetim/personel")).toBe(false);
  });

  it("customers reach nothing under /yonetim", () => {
    expect(canAccessRoute("CUSTOMER", "/yonetim")).toBe(false);
  });
});

describe("Faz 3 routes (events, support, cards, reports)", () => {
  it("SUPPORT works tickets and canned replies but not mailbox settings, events or billing", () => {
    expect(canAccessRoute("SUPPORT", "/yonetim/destek")).toBe(true);
    expect(canAccessRoute("SUPPORT", "/yonetim/destek/abc")).toBe(true);
    expect(canAccessRoute("SUPPORT", "/yonetim/destek/hazir-yanitlar")).toBe(true);
    expect(canAccessRoute("SUPPORT", "/yonetim/destek/ayarlar")).toBe(false);
    expect(canAccessRoute("SUPPORT", "/yonetim/olaylar")).toBe(false);
    expect(canAccessRoute("SUPPORT", "/yonetim/bildirimler/sablonlar")).toBe(false);
    expect(canAccessRoute("SUPPORT", "/yonetim/faturalar")).toBe(false);
  });

  it("BILLING sees reports and automatic collection, not support settings or TLD pricing", () => {
    expect(canAccessRoute("BILLING", "/yonetim/raporlar")).toBe(true);
    expect(canAccessRoute("BILLING", "/yonetim/faturalar/otomatik-tahsilat")).toBe(true);
    expect(canAccessRoute("BILLING", "/yonetim/destek/ayarlar")).toBe(false);
    expect(canAccessRoute("BILLING", "/yonetim/destek/hazir-yanitlar")).toBe(false);
    expect(canAccessRoute("BILLING", "/yonetim/urunler/tld-fiyatlari")).toBe(false);
    expect(canAccessRoute("BILLING", "/yonetim/bildirimler/hatirlatmalar")).toBe(false);
  });

  it("maps every new admin route explicitly", () => {
    expect(routePermissions("/yonetim/olaylar/evt1")).toEqual(["activity.view"]);
    expect(routePermissions("/yonetim/destek/ayarlar")).toEqual(["settings.manage"]);
    expect(routePermissions("/yonetim/faturalar/otomatik-tahsilat")).toEqual(["invoices.edit"]);
    expect(routePermissions("/yonetim/urunler/tld-fiyatlari")).toEqual(["products.manage"]);
    expect(routePermissions("/yonetim/bildirimler/hatirlatmalar")).toEqual(["settings.manage"]);
  });
});
