import { describe, expect, it } from "vitest";
import { validateCartItems } from "./validate-cart";

const tlds = [".com", ".com.tr", ".net"];

describe("validateCartItems (checkout gate)", () => {
  it("rejects an SSL certificate without a domain — the order that used to roll back a paid card", () => {
    const errors = validateCartItems([{ id: "ssl:SSL-DV-01:yearly", type: "ssl", metadata: { planCode: "SSL-DV-01" } }], {
      tlds,
    });
    expect(errors).toEqual([
      expect.objectContaining({ itemId: "ssl:SSL-DV-01:yearly", code: "DOMAIN_REQUIRED" }),
    ]);
  });

  it("accepts an SSL domain, a wildcard only for wildcard certificates", () => {
    expect(
      validateCartItems([{ id: "s", type: "ssl", metadata: { planCode: "SSL-DV-01", domain: "magaza.ornek.com.tr" } }])
    ).toEqual([]);
    expect(
      validateCartItems([{ id: "s", type: "ssl", metadata: { planCode: "SSL-DV-01", domain: "*.ornek.com" } }])[0]?.code
    ).toBe("DOMAIN_INVALID");
    expect(
      validateCartItems([
        { id: "s", type: "ssl", metadata: { planCode: "SSL-WC-DV", subType: "wildcard", domain: "*.ornek.com" } },
      ])
    ).toEqual([]);
  });

  it("checks domain items for a valid name and a sold extension", () => {
    expect(validateCartItems([{ id: "domain:ornek.com.tr", type: "domain" }], { tlds })).toEqual([]);
    expect(validateCartItems([{ id: "domain:ornek.xyz", type: "domain" }], { tlds })[0]?.code).toBe(
      "DOMAIN_TLD_NOT_SUPPORTED"
    );
    expect(validateCartItems([{ id: "domain:www.ornek.com", type: "domain" }], { tlds })[0]?.code).toBe(
      "DOMAIN_TLD_NOT_SUPPORTED"
    );
    expect(validateCartItems([{ id: "domain:-ornek.com", type: "domain" }], { tlds })[0]?.code).toBe(
      "DOMAIN_INVALID"
    );
    expect(validateCartItems([{ id: "domain:", type: "domain" }], { tlds })[0]?.code).toBe("DOMAIN_REQUIRED");
  });

  it("accepts Turkish IDN names (converted to punycode)", () => {
    expect(validateCartItems([{ id: "domain:şirket.com.tr", type: "domain" }], { tlds })).toEqual([]);
  });

  it("applies the hosting domain rules (yeni / kendi alan adım / sonra)", () => {
    const hosting = (domainChoice?: { type?: string; domain?: string }) => ({
      id: "hosting:H1:yearly",
      type: "hosting",
      metadata: { planCode: "H1", domainChoice },
    });

    expect(validateCartItems([hosting()], { tlds })).toEqual([]);
    expect(validateCartItems([hosting({ type: "later" })], { tlds })).toEqual([]);
    expect(validateCartItems([hosting({ type: "existing", domain: "benimsitem.com" })], { tlds })).toEqual([]);
    expect(validateCartItems([hosting({ type: "existing" })], { tlds })[0]?.code).toBe("DOMAIN_REQUIRED");
    expect(validateCartItems([hosting({ type: "existing", domain: "bad domain" })], { tlds })[0]?.code).toBe(
      "DOMAIN_INVALID"
    );
    expect(validateCartItems([hosting({ type: "new", domain: "yeni.com" })], { tlds })[0]?.code).toBe(
      "HOSTING_NEW_DOMAIN_NOT_IN_CART"
    );
    expect(
      validateCartItems([hosting({ type: "new", domain: "Yeni.com" }), { id: "domain:yeni.com", type: "domain" }], {
        tlds,
      })
    ).toEqual([]);
    expect(validateCartItems([hosting({ type: "bogus" })], { tlds })[0]?.code).toBe("HOSTING_DOMAIN_CHOICE_INVALID");
  });

  it("does not require a domain for servers", () => {
    expect(validateCartItems([{ id: "server:vds:v1", type: "server" }], { tlds })).toEqual([]);
  });
});
