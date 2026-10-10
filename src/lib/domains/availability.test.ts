import { describe, expect, it, vi } from "vitest";
import { createAvailabilityChecker, fetchRdapAnswer, type AvailabilityRegistrar } from "./availability";

function setup(registrar: AvailabilityRegistrar, rdap = vi.fn(async () => "error" as const)) {
  let clock = 0;
  const findLocal = vi.fn(async (domains: string[]) => domains.filter((domain) => domain === "bizde.com"));
  const checker = createAvailabilityChecker({ findLocal, registrar: async () => registrar, rdap, now: () => clock });
  return { checker, findLocal, rdap, tick: (ms: number) => (clock += ms) };
}

const skipped = { ok: false, skipped: true };

describe("domain availability checker", () => {
  it("uses the registrar batch answer as confirmed availability", async () => {
    const batch = vi.fn(async (domains: string[]) => ({
      ok: true,
      data: domains.map((domain) => ({ domain, available: domain.endsWith(".net") })),
    }));
    const { checker, rdap } = setup({ checkDomainsAvailability: batch, checkDomainAvailability: vi.fn() });
    const result = await checker.check(["a.com", "a.net", "bizde.com"]);
    expect(Object.fromEntries(result)).toEqual({ "a.com": "registered", "a.net": "available", "bizde.com": "registered" });
    expect(batch).toHaveBeenCalledWith(["a.com", "a.net"]);
    expect(rdap).not.toHaveBeenCalled();
  });

  it("falls back to RDAP when the registrar is off and never calls 'not found' available", async () => {
    const rdap = vi.fn(async (domain: string) =>
      domain === "a.com" ? ("registered" as const) : domain === "a.net" ? ("not_found" as const) : ("no_service" as const)
    );
    const { checker } = setup({ checkDomainAvailability: vi.fn(async () => skipped) }, rdap);
    const result = await checker.check(["a.com", "a.net", "a.com.tr"]);
    expect(Object.fromEntries(result)).toEqual({ "a.com": "registered", "a.net": "likely", "a.com.tr": "unknown" });
  });

  it("caches answers per TTL so repeated searches don't hit upstream", async () => {
    const single = vi.fn(async (domain: string) => ({ ok: true, data: { domain, available: true } }));
    const { checker, tick } = setup({ checkDomainAvailability: single });
    await checker.check(["a.com"]);
    await checker.check(["A.com"]);
    expect(single).toHaveBeenCalledTimes(1);
    tick(6 * 60 * 1000);
    await checker.check(["a.com"]);
    expect(single).toHaveBeenCalledTimes(2);
  });

  it("re-checks unknown answers sooner", async () => {
    const rdap = vi.fn(async () => "error" as const);
    const { checker, tick } = setup({ checkDomainAvailability: vi.fn(async () => skipped) }, rdap);
    await checker.check(["a.com"]);
    tick(61 * 1000);
    await checker.check(["a.com"]);
    expect(rdap).toHaveBeenCalledTimes(2);
  });

  it("treats a failing registrar like a missing one", async () => {
    const rdap = vi.fn(async () => "not_found" as const);
    const { checker } = setup(
      {
        checkDomainsAvailability: vi.fn(async () => {
          throw new Error("down");
        }),
        checkDomainAvailability: vi.fn(async () => ({ ok: false, error: "timeout" })),
      },
      rdap
    );
    expect((await checker.check(["a.dev"])).get("a.dev")).toBe("likely");
  });
});

describe("fetchRdapAnswer", () => {
  it("tells 'no such domain' from 'no RDAP service for this TLD'", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ errorCode: 404 }), { status: 404 }));
    expect(await fetchRdapAnswer("yok.com")).toBe("not_found");
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ title: "No RDAP service is available for this resource" }), { status: 404 })
    );
    expect(await fetchRdapAnswer("ornek.com.tr")).toBe("no_service");
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ objectClassName: "domain" }), { status: 200 }));
    expect(await fetchRdapAnswer("google.com")).toBe("registered");
    fetchMock.mockRejectedValueOnce(new Error("timeout"));
    expect(await fetchRdapAnswer("x.com")).toBe("error");
    fetchMock.mockRestore();
  });
});
