import { describe, expect, it } from "vitest";
import { buildAudienceWhere, describeAudience, parseAudience } from "./audience";

const andOf = (where: ReturnType<typeof buildAudienceWhere>) => where.AND as Record<string, unknown>[];

describe("broadcast audience filter", () => {
  it("defaults to active customers only, no consent requirement for service notices", () => {
    const where = buildAudienceWhere(parseAudience({}), "SERVICE");
    expect(andOf(where)).toEqual([{ role: "CUSTOMER" }, { status: { in: ["ACTIVE"] } }]);
  });

  it("marketing broadcasts require the marketing opt-in; service notices do not", () => {
    const filter = parseAudience({});
    expect(andOf(buildAudienceWhere(filter, "MARKETING"))).toContainEqual({ marketingConsent: true });
    expect(JSON.stringify(buildAudienceWhere(filter, "SERVICE"))).not.toContain("marketingConsent");
  });

  it("matches products and categories on the same service as the server target", () => {
    const filter = parseAudience({
      productIds: ["p1"],
      categoryIds: ["c1"],
      servers: [{ instanceId: "whm1" }, { instanceId: "pve", node: "node-a" }],
      serviceStatuses: ["ACTIVE"],
    });
    const services = andOf(buildAudienceWhere(filter, "SERVICE")).find((clause) => "services" in clause) as {
      services: { some: { AND: unknown[] } };
    };
    expect(services.services.some.AND).toEqual([
      { status: { in: ["ACTIVE"] } },
      { OR: [{ productId: { in: ["p1"] } }, { product: { categoryId: { in: ["c1"] } } }] },
      {
        OR: [
          { moduleInstanceId: "whm1" },
          { moduleInstanceId: "pve", moduleData: { path: ["proxmox", "node"], equals: "node-a" } },
        ],
      },
    ]);
  });

  it("filters by live domains with the given extensions (dot and case insensitive)", () => {
    const filter = parseAudience({ tlds: [".COM.TR", "net"] });
    expect(filter.tlds).toEqual(["com.tr", "net"]);
    const domains = andOf(buildAudienceWhere(filter, "SERVICE")).find((clause) => "domains" in clause);
    expect(domains).toEqual({
      domains: {
        some: {
          status: { in: ["ACTIVE", "PENDING", "TRANSFERRING"] },
          OR: [
            { name: { endsWith: ".com.tr", mode: "insensitive" } },
            { name: { endsWith: ".net", mode: "insensitive" } },
          ],
        },
      },
    });
  });

  it("rejects malformed extensions and unknown statuses", () => {
    expect(() => parseAudience({ tlds: ["com tr"] })).toThrow();
    expect(() => parseAudience({ userStatuses: ["DELETED"] })).toThrow();
  });

  it("customer type and account status filters", () => {
    const where = buildAudienceWhere(parseAudience({ customerTypes: ["CORPORATE"], userStatuses: ["ACTIVE", "SUSPENDED"] }), "SERVICE");
    expect(andOf(where)).toContainEqual({ customerType: { in: ["CORPORATE"] } });
    expect(andOf(where)).toContainEqual({ status: { in: ["ACTIVE", "SUSPENDED"] } });
  });

  it("describes a filter in Turkish", () => {
    const text = describeAudience(parseAudience({ servers: [{ instanceId: "i1", node: "pve2" }], tlds: ["com.tr"] }), {
      instances: new Map([["i1", "DCNET Proxmox"]]),
    });
    expect(text).toBe("Aktif müşteriler · DCNET Proxmox / pve2 · .com.tr");
  });
});
