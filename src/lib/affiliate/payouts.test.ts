import type { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  aggregateReferral,
  aggregatePayment,
  findManyReferral,
  updateManyReferral,
  createPayment,
  findUniquePayment,
  findUniqueUser,
  updatePayment,
  transaction,
} = vi.hoisted(() => ({
  aggregateReferral: vi.fn(),
  aggregatePayment: vi.fn(),
  findManyReferral: vi.fn(),
  updateManyReferral: vi.fn(),
  createPayment: vi.fn(),
  findUniquePayment: vi.fn(),
  findUniqueUser: vi.fn(),
  updatePayment: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: findUniqueUser,
    },
    affiliateReferral: {
      aggregate: aggregateReferral,
      findMany: findManyReferral,
      updateMany: updateManyReferral,
    },
    affiliatePayment: {
      aggregate: aggregatePayment,
      create: createPayment,
      findUnique: findUniquePayment,
      update: updatePayment,
    },
    $transaction: transaction,
  },
}));

import { MIN_PAYOUT_AMOUNT } from "./constants";
import {
  AffiliatePayoutError,
  approveAffiliatePayout,
  completeAffiliatePayout,
  getAffiliateBalance,
  rejectAffiliatePayout,
  requestAffiliatePayout,
} from "./payouts";
import { moneyEq } from "@/test-utils/money";

const pendingPayment = {
  id: "pay-1",
  affiliateId: "aff-1",
  amount: 120,
  status: "PENDING" as const,
  referralIds: ["ref-1", "ref-2"],
  notes: null,
  processedBy: null,
  paidAt: null,
  createdAt: new Date("2026-06-01T10:00:00.000Z"),
};

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
    findUniqueUser.mockReset();
    transaction.mockReset();

    findUniqueUser.mockResolvedValue({
      affiliatePayoutIban: "TR330006100519786457841326",
    });
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

  it("rejects payout when affiliate IBAN is missing", async () => {
    findUniqueUser.mockResolvedValue({ affiliatePayoutIban: null });

    await expect(requestAffiliatePayout("aff-1", 120)).rejects.toMatchObject({
      code: "INVALID_AMOUNT",
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
        amount: moneyEq(120),
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

describe("approveAffiliatePayout", () => {
  beforeEach(() => {
    findUniquePayment.mockReset();
    updatePayment.mockReset();
    findUniquePayment.mockResolvedValue(pendingPayment);
    updatePayment.mockResolvedValue({
      ...pendingPayment,
      processedBy: "admin-1",
      notes: "Yönetici tarafından onaylandı",
    });
  });

  it("records admin approval while keeping payout pending", async () => {
    const payment = await approveAffiliatePayout("pay-1", "admin-1");

    expect(updatePayment).toHaveBeenCalledWith({
      where: { id: "pay-1" },
      data: {
        processedBy: "admin-1",
        notes: "Yönetici tarafından onaylandı",
      },
    });
    expect(payment).toMatchObject({
      status: "PENDING",
      processedBy: "admin-1",
    });
  });

  it("rejects approval when payout is not found", async () => {
    findUniquePayment.mockResolvedValue(null);

    await expect(approveAffiliatePayout("missing", "admin-1")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(updatePayment).not.toHaveBeenCalled();
  });

  it("rejects approval when payout is not pending", async () => {
    findUniquePayment.mockResolvedValue({
      ...pendingPayment,
      status: "PAID",
    });

    await expect(approveAffiliatePayout("pay-1", "admin-1")).rejects.toMatchObject({
      code: "INVALID_STATUS",
    });
    expect(updatePayment).not.toHaveBeenCalled();
  });
});

describe("rejectAffiliatePayout", () => {
  const tx = {
    affiliateReferral: {
      updateMany: updateManyReferral,
    },
    affiliatePayment: {
      findUnique: findUniquePayment,
      update: updatePayment,
    },
  } as unknown as Prisma.TransactionClient;

  beforeEach(() => {
    findUniquePayment.mockReset();
    updatePayment.mockReset();
    updateManyReferral.mockReset();
    transaction.mockReset();

    transaction.mockImplementation(async (callback) => callback(tx));
    findUniquePayment.mockResolvedValue(pendingPayment);
    updatePayment.mockResolvedValue({
      ...pendingPayment,
      status: "CANCELLED",
      processedBy: "admin-1",
      notes: "Yetersiz bilgi",
    });
  });

  it("cancels payout and releases reserved referrals", async () => {
    const payment = await rejectAffiliatePayout("pay-1", "admin-1", "Yetersiz bilgi");

    expect(updateManyReferral).toHaveBeenCalledWith({
      where: { id: { in: ["ref-1", "ref-2"] } },
      data: { isPaid: false },
    });
    expect(updatePayment).toHaveBeenCalledWith({
      where: { id: "pay-1" },
      data: {
        status: "CANCELLED",
        processedBy: "admin-1",
        notes: "Yetersiz bilgi",
      },
    });
    expect(payment).toMatchObject({
      status: "CANCELLED",
      processedBy: "admin-1",
    });
  });

  it("uses default rejection note when reason is omitted", async () => {
    await rejectAffiliatePayout("pay-1", "admin-1");

    expect(updatePayment).toHaveBeenCalledWith({
      where: { id: "pay-1" },
      data: {
        status: "CANCELLED",
        processedBy: "admin-1",
        notes: "Yönetici tarafından reddedildi",
      },
    });
  });

  it("rejects cancellation when payout is not pending", async () => {
    findUniquePayment.mockResolvedValue({
      ...pendingPayment,
      status: "CANCELLED",
    });

    await expect(rejectAffiliatePayout("pay-1", "admin-1")).rejects.toMatchObject({
      code: "INVALID_STATUS",
    });
    expect(updateManyReferral).not.toHaveBeenCalled();
    expect(updatePayment).not.toHaveBeenCalled();
  });
});

describe("completeAffiliatePayout", () => {
  const approvedPayment = {
    ...pendingPayment,
    processedBy: "admin-1",
    notes: "Yönetici tarafından onaylandı",
  };

  beforeEach(() => {
    findUniquePayment.mockReset();
    updatePayment.mockReset();
    findUniquePayment.mockResolvedValue(approvedPayment);
    updatePayment.mockImplementation(async ({ data }) => ({
      ...approvedPayment,
      ...data,
    }));
  });

  it("marks payout as paid with timestamp and optional notes", async () => {
    const payment = await completeAffiliatePayout("pay-1", "admin-1", "Havale yapıldı");

    expect(updatePayment).toHaveBeenCalledWith({
      where: { id: "pay-1" },
      data: expect.objectContaining({
        status: "PAID",
        processedBy: "admin-1",
        notes: "Havale yapıldı",
        paidAt: expect.any(Date),
      }),
    });
    expect(payment).toMatchObject({
      status: "PAID",
      processedBy: "admin-1",
      notes: "Havale yapıldı",
      paidAt: expect.any(Date),
    });
  });

  it("rejects completion when payout is not found", async () => {
    findUniquePayment.mockResolvedValue(null);

    await expect(completeAffiliatePayout("missing", "admin-1")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(updatePayment).not.toHaveBeenCalled();
  });

  it("rejects completion when payout is already paid", async () => {
    findUniquePayment.mockResolvedValue({
      ...approvedPayment,
      status: "PAID",
      paidAt: new Date("2026-06-02T10:00:00.000Z"),
    });

    await expect(completeAffiliatePayout("pay-1", "admin-1")).rejects.toMatchObject({
      code: "INVALID_STATUS",
    });
    expect(updatePayment).not.toHaveBeenCalled();
  });

  it("rejects completion when payout is not approved", async () => {
    findUniquePayment.mockResolvedValue(pendingPayment);

    await expect(completeAffiliatePayout("pay-1", "admin-1")).rejects.toMatchObject({
      code: "INVALID_STATUS",
    });
    expect(updatePayment).not.toHaveBeenCalled();
  });
});

describe("AffiliatePayoutError", () => {
  it("exposes error code for callers", () => {
    const error = new AffiliatePayoutError("test", "BELOW_MINIMUM");
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("BELOW_MINIMUM");
  });
});