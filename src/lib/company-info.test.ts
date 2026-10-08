import { describe, expect, it, vi } from "vitest";
import {
  COMPANY_INFO_DEFAULTS,
  companyInfoFromSettings,
  isPlaceholderCompanyValue,
  loadCompanyInfo,
} from "./company-info";

describe("company info (contracts, e-mail footer, site footer)", () => {
  it("treats the seeded placeholder phone and address as unset", () => {
    expect(isPlaceholderCompanyValue("phone", "+90 850 000 00 00")).toBe(true);
    expect(isPlaceholderCompanyValue("address", "İstanbul, Türkiye")).toBe(true);
    expect(isPlaceholderCompanyValue("phone", "+90 850 123 45 67")).toBe(false);

    const info = companyInfoFromSettings({
      company_name: "KLEAWORK DIGITAL LLC",
      company_phone: "+90 850 000 00 00",
      company_address: "İstanbul, Türkiye",
      support_email: "destek@kleacore.com",
    });
    expect(info.phone).toBe("");
    expect(info.address).toBe(COMPANY_INFO_DEFAULTS.address);
    expect(info.email).toBe("destek@kleacore.com");
  });

  it("defaults to the company on the site footer", () => {
    expect(companyInfoFromSettings({})).toEqual({
      name: "KLEAWORK DIGITAL LLC",
      address: "30 N Gould St Ste R, Sheridan, WY 82801, USA",
      phone: "",
      email: "support@kleacore.com",
      taxId: "EIN 36-5157418",
      website: "https://kleacore.com",
    });
  });

  it("uses real configured values, the legal seller address first", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { key: "company_phone", value: " +90 212 555 00 11 " },
      { key: "company_address", value: "Kadıköy, İstanbul" },
      { key: "legal_seller_address", value: "Örnek Mah. 1, Ankara" },
    ]);

    const info = await loadCompanyInfo({ setting: { findMany } } as never);

    expect(info.phone).toBe("+90 212 555 00 11");
    expect(info.address).toBe("Örnek Mah. 1, Ankara");
  });
});
