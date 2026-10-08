import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn() }));

vi.mock("@/lib/db", () => ({
  db: { $queryRaw: queryRaw },
}));

import {
  formatDocumentNumber,
  generateAffiliateCode,
  generateInvoiceNumber,
  generateOrderNumber,
  generateTicketNumber,
} from "./number-generators";

function sqlText(call: unknown[]): string {
  const strings = call[0] as TemplateStringsArray;
  return strings.join("?");
}

describe("formatDocumentNumber", () => {
  it("pads the sequence to six digits", () => {
    expect(formatDocumentNumber("F", 2026, 123)).toBe("F-2026-000123");
    expect(formatDocumentNumber("S", 2026, 1)).toBe("S-2026-000001");
  });

  it("keeps growing past six digits instead of wrapping", () => {
    expect(formatDocumentNumber("F", 2026, 1234567)).toBe("F-2026-1234567");
  });
});

describe("sequential invoice / order numbers", () => {
  beforeEach(() => {
    vi.spyOn(Date.prototype, "getFullYear").mockReturnValue(2026);
    queryRaw.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("advances an existing counter with a single atomic UPDATE ... RETURNING", async () => {
    queryRaw.mockResolvedValueOnce([{ value: 124 }]);

    await expect(generateInvoiceNumber()).resolves.toBe("F-2026-000124");

    expect(queryRaw).toHaveBeenCalledTimes(1);
    const [call] = queryRaw.mock.calls;
    expect(sqlText(call)).toMatch(/UPDATE "number_sequences"/);
    expect(sqlText(call)).toMatch(/RETURNING "value"/);
    expect(call).toContain("invoice:F:2026");
  });

  it("seeds a new year's counter after the highest existing number", async () => {
    queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ value: 5501 }]);

    await expect(generateOrderNumber()).resolves.toBe("S-2026-005501");

    const insert = queryRaw.mock.calls[1];
    const text = sqlText(insert);
    expect(text).toMatch(/INSERT INTO "number_sequences"/);
    expect(text).toMatch(/MAX\(substring\(/);
    const rawIdentifiers = insert
      .filter((value): value is { sql: string } =>
        typeof value === "object" && value !== null && "sql" in value
      )
      .map((value) => value.sql);
    expect(rawIdentifiers).toEqual(['"orderNumber"', '"orders"', '"orderNumber"']);
    expect(text).toMatch(/ON CONFLICT \("key"\) DO UPDATE/);
    expect(insert).toContain("order:S:2026");
    expect(insert).toContain("^S-2026-([0-9]+)$");
  });

  it("never hands out the same number twice for concurrent callers", async () => {
    let counter = 0;
    queryRaw.mockImplementation(async () => [{ value: ++counter }]);

    const numbers = await Promise.all(
      Array.from({ length: 50 }, () => generateInvoiceNumber())
    );

    expect(new Set(numbers).size).toBe(50);
    expect(numbers).toContain("F-2026-000001");
    expect(numbers).toContain("F-2026-000050");
  });

  it("fails loudly instead of inventing a number when the counter is unavailable", async () => {
    queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await expect(generateInvoiceNumber()).rejects.toThrow("NUMBER_SEQUENCE_UNAVAILABLE");
  });
});

describe("random helpers", () => {
  beforeEach(() => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("generates ticket numbers with six-digit suffix", () => {
    expect(generateTicketNumber()).toBe("T-550000");
  });

  it("generates affiliate codes from name slug and three-digit suffix", () => {
    expect(generateAffiliateCode("Alice Smith")).toBe("alices550");
    expect(generateAffiliateCode("B0b!")).toBe("b0b550");
  });

  it("truncates long names to six alphanumeric characters", () => {
    expect(generateAffiliateCode("Christopher")).toBe("christ550");
  });
});
