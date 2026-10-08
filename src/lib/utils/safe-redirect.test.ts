import { describe, expect, it } from "vitest";
import {
  getSafeRedirectPath,
  isAllowedCheckoutUrl,
} from "./safe-redirect";

describe("getSafeRedirectPath", () => {
  it("returns fallback for unsafe redirects", () => {
    expect(getSafeRedirectPath("//evil.com", "/panel")).toBe("/panel");
    expect(getSafeRedirectPath("https://evil.com", "/panel")).toBe("/panel");
  });

  it("allows same-origin relative paths", () => {
    expect(getSafeRedirectPath("/musteri/panel")).toBe("/musteri/panel");
  });
});

describe("isAllowedCheckoutUrl", () => {
  it("allows trusted payment providers over https", () => {
    expect(
      isAllowedCheckoutUrl("https://checkout.stripe.com/c/pay/cs_test_123")
    ).toBe(true);
    expect(isAllowedCheckoutUrl("https://cpp.iyzipay.com/checkout/123")).toBe(
      true
    );
  });

  it("rejects untrusted or non-https urls", () => {
    expect(isAllowedCheckoutUrl("https://evil.com/phish")).toBe(false);
    expect(
      isAllowedCheckoutUrl("http://checkout.stripe.com/c/pay/cs_test_123")
    ).toBe(false);
  });
});

describe("isAllowedCheckoutUrl (own card form)", () => {
  it("allows our /odeme/ pages on the current origin only", () => {
    expect(
      isAllowedCheckoutUrl("http://localhost:3000/odeme/kuveytturk?ref=KC1", "http://localhost:3000")
    ).toBe(true);
    expect(
      isAllowedCheckoutUrl("https://kleacore.com/odeme/kuveytturk?ref=KC1", "https://kleacore.com")
    ).toBe(true);
    expect(
      isAllowedCheckoutUrl("https://evil.com/odeme/kuveytturk?ref=KC1", "https://kleacore.com")
    ).toBe(false);
    expect(isAllowedCheckoutUrl("https://kleacore.com/musteri/panel", "https://kleacore.com")).toBe(
      false
    );
    expect(isAllowedCheckoutUrl("https://kleacore.com/odeme/kuveytturk?ref=KC1")).toBe(false);
  });
});