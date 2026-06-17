import { describe, expect, it } from "vitest";
import {
  buildNetgsmXml,
  formatSmsMessage,
  normalizeSmsPhoneNumber,
} from "./providers/netgsm";

describe("netgsm message formatting", () => {
  it("normalizes Turkish phone numbers to 90-prefixed format", () => {
    expect(normalizeSmsPhoneNumber("0532 111 22 33")).toBe("905321112233");
    expect(normalizeSmsPhoneNumber("+90 532 111 22 33")).toBe("905321112233");
    expect(normalizeSmsPhoneNumber("5321112233")).toBe("905321112233");
  });

  it("escapes line breaks in SMS message body", () => {
    expect(formatSmsMessage("Satır 1\nSatır 2")).toBe("Satır 1\\nSatır 2");
    expect(formatSmsMessage("Satır 1\r\nSatır 2")).toBe("Satır 1\\nSatır 2");
  });

  it("builds Netgsm XML payload with header and recipient", () => {
    const xml = buildNetgsmXml({
      usercode: "user123",
      password: "secret",
      header: "KLEACORE",
      message: "Faturanız ödendi: F-2026-0001",
      numbers: ["905321112233"],
    });

    expect(xml).toContain("<usercode>user123</usercode>");
    expect(xml).toContain("<msgheader>KLEACORE</msgheader>");
    expect(xml).toContain("<![CDATA[Faturanız ödendi: F-2026-0001]]>");
    expect(xml).toContain("<no>905321112233</no>");
    expect(xml).toContain("<type>1:n</type>");
  });
});