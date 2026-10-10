import { describe, expect, it } from "vitest";
import { parseInvoiceIds, retryPaymentHref, servicePanelLink } from "./result-links";

describe("payment result links", () => {
  it("sends each category to its panel page", () => {
    expect(servicePanelLink("domain").href).toBe("/musteri/panel/domainler");
    expect(servicePanelLink("vds").href).toBe("/musteri/panel/sunucular");
    expect(servicePanelLink("ssl").href).toBe("/musteri/panel/ssl");
    expect(servicePanelLink("hosting").href).toBe("/musteri/panel/hizmetlerim");
    expect(servicePanelLink(null).href).toBe("/musteri/panel/hizmetlerim");
  });

  it("retries a single invoice on its own page, several on the list", () => {
    expect(retryPaymentHref(["inv_1"])).toBe("/musteri/panel/faturalar/inv_1");
    expect(retryPaymentHref(["inv_1", "inv_2"])).toBe("/musteri/panel/faturalar");
  });

  it("parses, de-duplicates and caps invoice ids", () => {
    expect(parseInvoiceIds(" a, b,,a ")).toEqual(["a", "b"]);
    expect(parseInvoiceIds(undefined)).toEqual([]);
    expect(parseInvoiceIds("a,b,c", 2)).toEqual(["a", "b"]);
  });
});
