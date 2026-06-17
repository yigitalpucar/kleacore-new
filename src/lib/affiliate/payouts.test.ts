import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  aggregateReferral,
  aggregatePayment,
  findManyReferral,
  updateManyReferral,
  createPayment,
  transaction,
} = vi.hoisted(() => ({
  aggregateReferral: vi.fn(),
  aggregatePayment: vi.fn(),
  findManyReferral: vi.fn(),
  updateManyReferral: vi.fn(),
  createPayment: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    affiliateReferral: {
      aggregate: aggregateReferral,
      findMany: findManyReferral,
      updateMany: updateManyReferral,
    },
    affiliatePayment: {
      aggregate: aggregatePayment,
      create: createPayment,
    },
    $transaction: transaction,
  },
}));

import { MIN_PAYOUT_AMOUNT } from "./constants";
import {
  AffiliatePayoutError,
  getAffiliateBalance,
  requestAffiliatePayout,
} from "./payouts";

describe("getAffiliateBalance", () => {
  beforeEach(() => {
    aggregateReferral.mockReset();
    aggregatePayment.mockReset();
  });

  it("returns total commissions minus pending and paid payouts", async () => {
    aggregateReferral.mockResolvedValue({ _sum: { commission: 500 } });
    aggregatePayment.mockResolvedValue({ _sum: { amount: 150 } });

    const balance = await getAffiliateBalance("aff-1");

    expect(balance).toBe(350);
    expect(aggregatePayment).toHaveBeenCalledWith({
      where: {
        affiliateId: "aff-1",
        status: { in: ["PENDING", "PAID"] },
      },
      _sum: { amount: true },
    });
  });

  it("returns zero when commissions equal reserved payouts", async () => {
    aggregateReferral.mockResolvedValue({ _sum: { commission: 200 } });
    aggregatePayment.mockResolvedValue({ _sum: { amount: 200 } });

    const balance = await getAffiliateBalance("aff-2");

    expect(balance).toBe(0);
  });

  it("ignores cancelled payouts in balance calculation", async () => {
    aggregateReferral.mockResolvedValue({ _sum: { commission: 300 } });
    aggregatePayment.mockResolvedValue({ _sum: { amount: 100 } });

    await getAffiliateBalance("aff-3");

    expect(aggregatePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["PENDING", "PAID"] },
        }),
      })
    );
  });
});

describe("requestAffiliatePayout", () => {
  const tx = {
    affiliateReferral: {
      aggregate: aggregateReferral,
      findMany: findManyReferral,
      updateMany: updateManyReferral,
    },
    affiliatePayment: {
      aggregate: aggregatePayment,
      create: createPayment,
    },
  } as unknown as Prisma.TransactionClient;

  beforeEach(() => {
    aggregateReferral.mockReset();
    aggregatePayment.mockReset();
    findManyReferral.mockReset();
    updateManyReferral.mockReset();
    createPayment.mockReset();
    transaction.mockReset();

    transaction.mockImplementation(async (callback) => callback(tx));
    aggregateReferral.mockResolvedValue({ _sum: { commission: 500 } });
    aggregatePayment.mockResolvedValue({ _sum: { amount: 0 } });
    findManyReferral.mockResolvedValue([
      { id: "ref-1", commission: 80 },
      { id: "ref-2", commission: 50 },
    ]);
    createPayment.mockResolvedValue({
      id: "pay-1",
      affiliateId: "aff-1",
      amount: 120,
      status: "PENDING",
    });
  });

  it("rejects invalid amounts", async () => {
    await expect(requestAffiliatePayout("aff-1", 0)).rejects.toMatchObject({
      code: "INVALID_AMOUNT",
    });
    await expect(requestAffiliatePayout("aff-1", Number.NaN)).rejects.toMatchObject({
      code: "INVALID_AMOUNT",
    });
  });

  it("rejects amounts below minimum payout threshold", async () => {
    await expect(
      requestAffiliatePayout("aff-1", MIN_PAYOUT_AMOUNT - 1)
    ).rejects.toMatchObject({
      code: "BELOW_MINIMUM",
    });

    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects amounts exceeding available balance", async () => {
    aggregateReferral.mockResolvedValue({ _sum: { commission: 150 } });
    aggregatePayment.mockResolvedValue({ _sum: { amount: 0 } });

    await expect(requestAffiliatePayout("aff-1", 200)).rejects.toMatchObject({
      code: "INSUFFICIENT_BALANCE",
    });
  });

  it("creates a pending payout and marks referrals as paid", async () => {
    const payment = await requestAffiliatePayout("aff-1", 120);

    expect(updateManyReferral).toHaveBeenCalledWith({
      where: { id: { in: ["ref-1", "ref-2"] } },
      data: { isPaid: true },
    });
    expect(createPayment).toHaveBeenCalledWith({
      data: {
        affiliateId: "aff-1",
        amount: 120,
        status: "PENDING",
        referralIds: ["ref-1", "ref-2"],
      },
    });
    expect(payment).toEqual(
      expect.objectContaining({
        id: "pay-1",
        amount: 120,
        status: "PENDING",
      })
    );
  });
});

describe("AffiliatePayoutError", () => {
  it("exposes error code for callers", () => {
    const error = new AffiliatePayoutError("test", "BELOW_MINIMUM");
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("BELOW_MINIMUM");
  });
});