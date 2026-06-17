import { describe, expect, it } from "vitest";
import {
  buildServiceEmailAddress,
  normalizeLocalPart,
  validateEmailAddressForService,
  validateLocalPart,
  validatePassword,
  validateServiceDomain,
} from "./index";

describe("email provisioning address validation", () => {
  it("normalizes local parts to lowercase", () => {
    expect(normalizeLocalPart("  Info.Mail  ")).toBe("info.mail");
  });

  it("builds a service-scoped email address", () => {
    expect(buildServiceEmailAddress("Support", "Example.COM")).toBe("support@example.com");
  });

  it("accepts valid local parts", () => {
    expect(validateLocalPart("info.mail")).toEqual({ ok: true, value: "info.mail" });
    expect(validateLocalPart("sales-team_01")).toEqual({ ok: true, value: "sales-team_01" });
  });

  it("rejects invalid local parts", () => {
    expect(validateLocalPart("a")).toMatchObject({ ok: false });
    expect(validateLocalPart("user@host")).toMatchObject({ ok: false });
    expect(validateLocalPart("bad name")).toMatchObject({ ok: false });
  });

  it("validates service domains", () => {
    expect(validateServiceDomain("example.com")).toEqual({
      ok: true,
      value: "example.com",
    });
    expect(validateServiceDomain("not a domain")).toMatchObject({ ok: false });
  });

  it("requires email addresses to match the service domain", () => {
    expect(validateEmailAddressForService("info@example.com", "example.com")).toEqual({
      ok: true,
      value: {
        address: "info@example.com",
        localPart: "info",
        domain: "example.com",
      },
    });

    expect(validateEmailAddressForService("info@other.com", "example.com")).toMatchObject({
      ok: false,
      error: "E-posta adresi hizmet domaini ile eşleşmiyor",
    });

    expect(validateEmailAddressForService("invalid@", "example.com")).toMatchObject({
      ok: false,
    });
  });

  it("validates provisioning passwords", () => {
    expect(validatePassword("short")).toMatchObject({ ok: false });
    expect(validatePassword("secure-pass")).toEqual({ ok: true, value: "secure-pass" });
  });
});