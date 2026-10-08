import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const store = new Map<string, { id: string; buying: unknown; selling: unknown; banknoteSelling: unknown }>();
  return {
    store,
    findUnique: vi.fn(async ({ where }: { where: { currency_date: { currency: string; date: Date } } }) => {
      const key = `${where.currency_date.currency}:${where.currency_date.date.toISOString()}`;
      return store.get(key) ?? null;
    }),
    create: vi.fn(async ({ data }: { data: { currency: string; date: Date; buying: unknown; selling: unknown; banknoteSelling: unknown } }) => {
      store.set(`${data.currency}:${data.date.toISOString()}`, { id: data.currency, ...data });
      return data;
    }),
    update: vi.fn(),
    apply: vi.fn(),
    rules: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  db: { exchangeRate: { findUnique: mocks.findUnique, create: mocks.create, update: mocks.update } },
}));
vi.mock("./tld-pricing", () => ({
  applyTldSuggestedPrices: mocks.apply,
  getTldPricingRules: mocks.rules,
}));

import { syncTcmbRates } from "./sync";

const fixture = readFileSync(join(__dirname, "__fixtures__", "tcmb-today.xml"), "utf8");
const ok = (() => Promise.resolve(new Response(fixture, { status: 200 }))) as unknown as typeof fetch;

describe("syncTcmbRates", () => {
  beforeEach(() => {
    mocks.store.clear();
    vi.clearAllMocks();
    mocks.rules.mockResolvedValue({ autoApply: false });
  });

  it("stores USD/EUR/GBP of the bulletin date only", async () => {
    const result = await syncTcmbRates({ fetchImpl: ok });
    expect(result).toMatchObject({ status: "stored", date: "2026-10-08", created: 3, autoApply: "disabled" });
    expect(mocks.create).toHaveBeenCalledTimes(3);
    const usd = mocks.create.mock.calls.find((c) => c[0].data.currency === "USD")![0].data;
    expect(usd.date.toISOString()).toBe("2026-10-08T00:00:00.000Z");
    expect((usd.selling as Prisma.Decimal).toString()).toBe("41.7278");
    expect(mocks.apply).not.toHaveBeenCalled();
  });

  it("keeps the last rate when today.xml still serves the previous bulletin (weekend)", async () => {
    await syncTcmbRates({ fetchImpl: ok });
    mocks.create.mockClear();
    const again = await syncTcmbRates({ fetchImpl: ok });
    expect(again.status).toBe("unchanged");
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("does nothing when the archive has no bulletin for the day", async () => {
    const notFound = (() => Promise.resolve(new Response("", { status: 404 }))) as unknown as typeof fetch;
    await expect(syncTcmbRates({ date: "2026-10-10", fetchImpl: notFound })).resolves.toEqual({
      status: "no-bulletin",
      date: "2026-10-10",
    });
  });

  it("auto-applies TLD prices only when the rule is switched on, attributed to its admin", async () => {
    mocks.rules.mockResolvedValue({ autoApply: true, updatedBy: "admin-1" });
    mocks.apply.mockResolvedValue({ ok: true, applied: [{}], skipped: [] });
    const result = await syncTcmbRates({ fetchImpl: ok });
    expect(mocks.apply).toHaveBeenCalledWith({ actorId: "admin-1", source: "auto" });
    expect(result.autoApply).toEqual({ applied: 1, skipped: 0 });
  });
});
