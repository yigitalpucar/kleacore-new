import type { Prisma, PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

type DbClient = Prisma.TransactionClient | PrismaClient;
import {
  AFFILIATE_COMMISSION_RATE,
  applyAffiliateCommission,
  generateUniqueAffiliateCode,
  getSafeRedirectPath,
  resolveAffiliateByRefCode,
} from "./index";

describe("getSafeRedirectPath", () => {
  it("returns / when redirect is missing", () => {
    expect(getSafeRedirectPath(null)).toBe("/");
    expect(getSafeRedirectPath(undefined)).toBe("/");
    expect(getSafeRedirectPath("")).toBe("/");
  });

  it("allows same-origin relative paths", () => {
    expect(getSafeRedirectPath("/dashboard")).toBe("/dashboard");
    expect(getSafeRedirectPath("/checkout?ref=abc")).toBe("/checkout?ref=abc");
  });

  it("blocks protocol-relative and external redirects", () => {
    expect(getSafeRedirectPath("//evil.com")).toBe("/");
    expect(getSafeRedirectPath("https://evil.com")).toBe("/");
  });
});

describe("generateUniqueAffiliateCode", () => {
  const findUnique = vi.fn();

  const client = {
    user: { findUnique },
  } as unknown as DbClient;

  beforeEach(() => {
    findUnique.mockReset();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  it("returns the first unused code", async () => {
    findUnique.mockResolvedValue(null);

    const code = await generateUniqueAffiliateCode(client, "Alice");

    expect(code).toMatch(/^alice\d{3}$/);
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it("retries when a generated code already exists", async () => {
    findUnique
      .mockResolvedValueOnce({ id: "existing" })
      .mockResolvedValueOnce(null);

    const code = await generateUniqueAffiliateCode(client, "Bob");

    expect(code).toMatch(/^bob\d{3}$/);
    expect(findUnique).toHaveBeenCalledTimes(2);
  });

  it("appends a suffix after repeated collisions", async () => {
    findUnique.mockResolvedValue({ id: "existing" });

    const code = await generateUniqueAffiliateCode(client, "Carol");

    expect(code).toMatch(/^carol\d{3}[a-z0-9]{4}$/);
    expect(findUnique).toHaveBeenCalledTimes(10);
  });
});

describe("resolveAffiliateByRefCode", () => {
  const findFirst = vi.fn();

  const client = {
    user: { findFirst },
  } as unknown as DbClient;

  beforeEach(() => {
    findFirst.mockReset();
  });

  it("returns null for empty ref codes", async () => {
    expect(await resolveAffiliateByRefCode(client, null)).toBeNull();
    expect(await resolveAffiliateByRefCode(client, "   ")).toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("looks up active affiliates by trimmed code", async () => {
    const affiliate = { id: "aff-1", affiliateCode: "alice550" };
    findFirst.mockResolvedValue(affiliate);

    const result = await resolveAffiliateByRefCode(client, "  alice550  ");

    expect(result).toEqual(affiliate);
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        affiliateCode: "alice550",
        status: "ACTIVE",
      },
      select: {
        id: true,
        affiliateCode: true,
      },
    });
  });
});

describe("applyAffiliateCommission", () => {
  const findFirst = vi.fn();
  const update = vi.fn();

  const tx = {
    affiliateReferral: {
      findFirst,
      update,
    },
  } as unknown as Prisma.TransactionClient;

  beforeEach(() => {
    findFirst.mockReset();
    update.mockReset();
  });

  it("skips commission for invalid or non-positive order totals", async () => {
    await applyAffiliateCommission(tx, { customerId: "cust-1", orderTotal: 0 });
    await applyAffiliateCommission(tx, {
      customerId: "cust-1",
      orderTotal: Number.NaN,
    });

    expect(findFirst).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it("skips when the customer has no referral", async () => {
    findFirst.mockResolvedValue(null);

    await applyAffiliateCommission(tx, {
      customerId: "cust-1",
      orderTotal: 100,
    });

    expect(findFirst).toHaveBeenCalledWith({
      where: { referredId: "cust-1" },
      select: { id: true },
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("increments commission at the configured rate", async () => {
    findFirst.mockResolvedValue({ id: "ref-1" });

    await applyAffiliateCommission(tx, {
      customerId: "cust-1",
      orderTotal: 99.99,
    });

    expect(AFFILIATE_COMMISSION_RATE).toBe(0.1);
    expect(update).toHaveBeenCalledWith({
      where: { id: "ref-1" },
      data: {
        commission: { increment: expect.anything() },
      },
    });
    // 99.99 × 10 % = 9.999 -> 10.00 (half-up, Decimal)
    expect(update.mock.calls[0][0].data.commission.increment.toFixed(2)).toBe("10.00");
  });

  it("rounds half-up to kuruş (0.05 × 10 % = 0.005 -> 0.01)", async () => {
    findFirst.mockResolvedValue({ id: "ref-3" });

    await applyAffiliateCommission(tx, { customerId: "cust-3", orderTotal: 0.05 });

    expect(update.mock.calls[0][0].data.commission.increment.toFixed(2)).toBe("0.01");
  });

  it("rounds commission to two decimal places", async () => {
    findFirst.mockResolvedValue({ id: "ref-2" });

    await applyAffiliateCommission(tx, {
      customerId: "cust-2",
      orderTotal: 33.33,
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: "ref-2" },
      data: {
        commission: { increment: expect.anything() },
      },
    });
    expect(update.mock.calls[0][0].data.commission.increment.toFixed(2)).toBe("3.33");
  });
});