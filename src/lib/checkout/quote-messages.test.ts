import { describe, expect, it } from "vitest";
import { promoErrorMessage, quoteLineErrorMessage } from "./quote-messages";

describe("cart quote messages", () => {
  it("explains why a coupon was rejected", () => {
    expect(promoErrorMessage(new Error("PROMO_EXPIRED"))).toMatch(/geçerli değil/);
    expect(promoErrorMessage(new Error("PROMO_MIN_ORDER"), { minOrder: "5.000,00 ₺" })).toContain("5.000,00 ₺");
    expect(promoErrorMessage(new Error("PROMO_FIRST_ORDER_ONLY"))).toMatch(/ilk sipariş/);
    expect(promoErrorMessage(new Error("boom"))).toMatch(/doğrulanamadı/);
  });

  it("maps line pricing failures", () => {
    expect(quoteLineErrorMessage(new Error("PRODUCT_NOT_FOUND:X"))).toMatch(/satışta değil/);
    expect(quoteLineErrorMessage(new Error("CONFIG_INVALID:RAM seçin"))).toBe("RAM seçin");
    expect(quoteLineErrorMessage(new Error("DOMAIN_TLD_NOT_FOUND:a.xyz"))).toMatch(/uzantısı/);
  });
});
