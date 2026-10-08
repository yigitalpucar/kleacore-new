import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { extractGriExpiry, parseGriDomainInfo } from "./gri";

describe("parseGriDomainInfo", () => {
  it("reads expiry, status and nameservers from a JSON:API style payload", () => {
    const info = parseGriDomainInfo("ornek.com", {
      status: true,
      data: {
        attributes: {
          expiration_date: "2027-11-07 00:00:00",
          status: "active",
          dns: [{ name: "NS1.Kleacore.com." }, { name: "ns2.kleacore.com", ip: "" }],
        },
      },
    });

    expect(info.expiresAt?.getFullYear()).toBe(2027);
    expect(info.status).toBe("active");
    expect(info.nameservers).toEqual(["ns1.kleacore.com", "ns2.kleacore.com"]);
  });

  it("leaves missing or empty fields undefined/null instead of empty values", () => {
    const info = parseGriDomainInfo("ornek.com", { data: { expire_date: "", dns: [] } });

    expect(info).toEqual({ domain: "ornek.com", expiresAt: null, status: null, nameservers: undefined });
  });
});

describe("extractGriExpiry", () => {
  it("finds the expiry in a renew response under any known key", () => {
    expect(extractGriExpiry({ status: true, expires_at: "2028-01-02T00:00:00Z" })?.toISOString()).toBe(
      "2028-01-02T00:00:00.000Z"
    );
    expect(extractGriExpiry({ status: true, message: "ok" })).toBeNull();
  });
});
