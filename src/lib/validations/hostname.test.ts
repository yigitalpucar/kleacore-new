import { describe, expect, it } from "vitest";
import { checkHostname } from "./hostname";

describe("checkHostname", () => {
  it.each([
    ["web01", "web01"],
    ["Web01.Ornek.COM", "web01.ornek.com"],
    ["  vds-1.ornek.com.tr. ", "vds-1.ornek.com.tr"],
    ["a", "a"],
  ])("accepts %s", (raw, expected) => {
    expect(checkHostname(raw)).toEqual({ ok: true, hostname: expected });
  });

  it.each([
    [""],
    ["   "],
    ["-web.ornek.com"],
    ["web-.ornek.com"],
    ["web..ornek.com"],
    [".ornek.com"],
    ["web_01.ornek.com"],
    ["sunucu-ğ.com"],
    ["web 01"],
    ["203.0.113.10"],
    [`${"a".repeat(64)}.com`],
    [`${"abc.".repeat(64)}com`],
  ])("rejects %j", (raw) => {
    const result = checkHostname(raw);
    expect(result.ok).toBe(false);
  });

  it("explains why an IP is refused", () => {
    expect(checkHostname("10.0.0.1")).toMatchObject({ ok: false, error: expect.stringContaining("IP") });
  });
});
