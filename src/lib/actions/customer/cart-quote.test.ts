import { beforeEach, describe, expect, it, vi } from "vitest";
import { money } from "@/lib/money";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  rateLimit: vi.fn(),
  getCatalogProduct: vi.fn(),
  getDomainProduct: vi.fn(),
  calculatePromotion: vi.fn(),
  reseller: vi.fn(),
  promoFind: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: { promotionCode: { findUnique: mocks.promoFind } } }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mocks.rateLimit, normalizeRateLimitKey: (v: string) => v }));
vi.mock("@/lib/request-meta", () => ({ getRequestMeta: async () => ({ ip: "1.2.3.4" }) }));
vi.mock("@/lib/billing/tax", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/billing/tax")>()),
  getTaxRate: async () => 20,
}));
vi.mock("@/lib/reseller", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/reseller")>()),
  getResellerDiscountForCustomer: mocks.reseller,
}));
vi.mock("@/lib/checkout/pricing", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/checkout/pricing")>()),
  getCatalogProduct: mocks.getCatalogProduct,
  getDomainProduct: mocks.getDomainProduct,
  calculatePromotion: mocks.calculatePromotion,
}));

import { previewCartQuote } from "./cart-quote";

const hostingProduct = (period: "monthly" | "yearly") => ({
  product: {
    sku: "HST-LNX-01",
    category: { slug: "hosting" },
    pricingTiers: [
      { period: "monthly", isActive: true },
      { period: "yearly", isActive: true },
    ],
  },
  billingPeriod: period,
  unitPrice: money(period === "yearly" ? 468 : 49),
});

const hostingItem = {
  id: "hosting:HST-LNX-01:yearly",
  type: "hosting" as const,
  quantity: 1,
  metadata: { planCode: "HST-LNX-01", billingPeriod: "yearly" as const },
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue(null);
  mocks.rateLimit.mockResolvedValue({ allowed: true, remaining: 10 });
  mocks.reseller.mockResolvedValue(null);
  mocks.getCatalogProduct.mockImplementation(async (item: { metadata?: { billingPeriod?: "monthly" | "yearly" } }) =>
    hostingProduct(item.metadata?.billingPeriod === "yearly" ? "yearly" : "monthly")
  );
});

describe("previewCartQuote", () => {
  it("prices lines with per-line KDV and offers the other billing period", async () => {
    const result = await previewCartQuote({ items: [hostingItem] });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({ subtotal: 468, taxAmount: 93.6, total: 561.6, promo: null });
    expect(result.data.lines[0]).toMatchObject({
      ok: true,
      period: "yearly",
      periodOptions: [
        { period: "monthly", unitPrice: 49 },
        { period: "yearly", unitPrice: 468 },
      ],
    });
  });

  it("checks a guest's coupon without customer rules and applies its discount", async () => {
    mocks.calculatePromotion.mockResolvedValue({
      id: "p1",
      code: "YUZDE10",
      discountAmount: money(46.8),
      applicableTotal: money(468),
      applicableCategories: [],
      applicableProducts: [],
      applicablePeriods: [],
    });
    const result = await previewCartQuote({ items: [hostingItem], promoCode: " yuzde10 " });
    expect(mocks.calculatePromotion.mock.calls[0][1]).toBe("YUZDE10");
    expect(mocks.calculatePromotion.mock.calls[0][2]).toBeNull();
    expect(result.success && result.data).toMatchObject({
      promoDiscount: 46.8,
      total: 505.44,
      promo: { code: "YUZDE10", ok: true, discount: 46.8 },
    });
  });

  it("explains a rejected coupon and still returns the totals", async () => {
    mocks.calculatePromotion.mockRejectedValue(new Error("PROMO_MIN_ORDER"));
    mocks.promoFind.mockResolvedValue({ minOrderAmount: money(5000) });
    const result = await previewCartQuote({ items: [hostingItem], promoCode: "BUYUK" });
    expect(result.success && result.data.total).toBe(561.6);
    expect(result.success && result.data.promo).toMatchObject({ ok: false });
    expect(result.success && result.data.promo && !result.data.promo.ok && result.data.promo.error).toContain("5.000");
  });

  it("limits coupon guessing separately", async () => {
    mocks.rateLimit.mockImplementation(async ({ key }: { key: string }) => ({
      allowed: !key.startsWith("cart-quote-promo"),
      remaining: 0,
    }));
    const result = await previewCartQuote({ items: [hostingItem], promoCode: "X" });
    expect(mocks.calculatePromotion).not.toHaveBeenCalled();
    expect(result.success && result.data.promo).toMatchObject({ ok: false });
  });

  it("reports a line that is no longer sold", async () => {
    mocks.getCatalogProduct.mockRejectedValue(new Error("PRODUCT_NOT_FOUND:HST-LNX-01"));
    const result = await previewCartQuote({ items: [hostingItem] });
    expect(result.success && result.data.lines[0]).toMatchObject({ ok: false, error: expect.stringMatching(/satışta/) });
    expect(result.success && result.data.total).toBe(0);
  });
});

describe("previewCartQuote server hostname", () => {
  it("flags an invalid hostname on the line, like checkoutCart refuses it", async () => {
    const result = await previewCartQuote({
      items: [
        {
          id: "server:vds:vds-1:monthly:tr:-bad_host",
          type: "server",
          quantity: 1,
          metadata: { planCode: "VDS-1", billingPeriod: "monthly", hostname: "-bad_host" },
        },
      ],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.lines[0]).toMatchObject({ ok: false, error: expect.stringContaining("Sunucu adı geçersiz") });
    expect(mocks.getCatalogProduct).not.toHaveBeenCalled();
    expect(result.data.total).toBe(0);
  });
});
