import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  emitEvent: vi.fn(),
  prepareOrderProvisioning: vi.fn(),
  getKycConfig: vi.fn(),
  db: {} as Record<string, unknown>,
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/events/emit", () => ({ emitEvent: mocks.emitEvent }));
vi.mock("@/lib/kyc/settings", () => ({ getKycConfig: mocks.getKycConfig }));
vi.mock("./internal", () => ({ prepareOrderProvisioning: mocks.prepareOrderProvisioning }));

import type { Prisma } from "@prisma/client";
import { holdOrderProvisioningIfNeeded, holdReasonsFor, releaseHeldOrder, releaseHeldOrdersForCustomer } from "./hold";

const KYC = { requiredCategories: ["vds", "server", "datacenter"], rejectedRetentionDays: 30 };

type FakeOrder = {
  id: string;
  orderNumber: string;
  customerId: string;
  serviceId: string | null;
  status: string;
  provisioningHeldAt: Date | null;
  provisioningHoldReasons: string[];
  fraudCheck: { status: string } | null;
  product: { name: string; category: { slug: string } };
  customer: { kycStatus: string };
  completedAt?: Date | null;
};

function store(order: Partial<FakeOrder> = {}) {
  const state: { order: FakeOrder; activities: Array<Record<string, unknown>> } = {
    order: {
      id: "ord-1",
      orderNumber: "S-1",
      customerId: "cus-1",
      serviceId: null,
      status: "COMPLETED",
      provisioningHeldAt: null,
      provisioningHoldReasons: [],
      fraudCheck: null,
      product: { name: "VDS Pro", category: { slug: "vds" } },
      customer: { kycStatus: "NONE" },
      ...order,
    },
    activities: [],
  };
  const tx = {
    $queryRaw: vi.fn(async () => []),
    order: {
      findUnique: vi.fn(async () => ({ ...state.order })),
      findMany: vi.fn(async () => (state.order.provisioningHeldAt ? [{ id: state.order.id }] : [])),
      update: vi.fn(async ({ data }: { data: Partial<FakeOrder> }) => Object.assign(state.order, data)),
      updateMany: vi.fn(async ({ where, data }: { where: { provisioningHeldAt?: unknown }; data: Partial<FakeOrder> }) => {
        if (where.provisioningHeldAt && !state.order.provisioningHeldAt) return { count: 0 };
        Object.assign(state.order, data);
        return { count: 1 };
      }),
    },
    orderActivity: { create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => state.activities.push(data)) },
  };
  const client = { ...tx, $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) };
  return { state, tx: tx as unknown as Prisma.TransactionClient, client };
}

beforeEach(() => {
  mocks.getKycConfig.mockResolvedValue(KYC);
  mocks.prepareOrderProvisioning.mockResolvedValue({ type: "service", identifier: "svc-1", status: "MANUAL", taskId: "pj-1" });
});

describe("holdReasonsFor", () => {
  it("holds for an open or rejected review, and for KYC categories without approval", () => {
    expect(holdReasonsFor({ fraudStatus: "REVIEW", categorySlug: "hosting", kycStatus: "NONE" }, KYC)).toEqual(["FRAUD_REVIEW"]);
    expect(holdReasonsFor({ fraudStatus: "REJECTED", categorySlug: "hosting", kycStatus: "NONE" }, KYC)).toEqual(["FRAUD_REVIEW"]);
    expect(holdReasonsFor({ fraudStatus: "PASSED", categorySlug: "vds", kycStatus: "PENDING" }, KYC)).toEqual(["KYC"]);
    expect(holdReasonsFor({ fraudStatus: "REVIEW", categorySlug: "server", kycStatus: "REJECTED" }, KYC)).toEqual(["FRAUD_REVIEW", "KYC"]);
  });

  it("lets approved / passed orders and non-KYC categories through", () => {
    expect(holdReasonsFor({ fraudStatus: "APPROVED", categorySlug: "vds", kycStatus: "APPROVED" }, KYC)).toEqual([]);
    expect(holdReasonsFor({ fraudStatus: null, categorySlug: "hosting", kycStatus: "NONE" }, KYC)).toEqual([]);
    expect(holdReasonsFor({ fraudStatus: "PASSED", categorySlug: "vds", kycStatus: "NONE" }, { requiredCategories: [] })).toEqual([]);
  });
});

describe("holdOrderProvisioningIfNeeded", () => {
  it("parks a paid VDS order of an unverified customer and asks for KYC", async () => {
    const { state, tx } = store();
    const reasons = await holdOrderProvisioningIfNeeded(tx, "ord-1", { performedBy: "cus-1", invoiceId: "inv-1" });

    expect(reasons).toEqual(["KYC"]);
    expect(state.order).toMatchObject({ status: "PROCESSING", provisioningHoldReasons: ["KYC"] });
    expect(state.order.provisioningHeldAt).toBeInstanceOf(Date);
    expect(state.activities[0]).toMatchObject({ action: "PROVISIONING_HELD" });
    expect(mocks.emitEvent).toHaveBeenCalledWith(tx, "kyc.required", expect.objectContaining({ userId: "cus-1", orderId: "ord-1" }));
  });

  it("does not ask again while the documents are being reviewed", async () => {
    const { tx } = store({ customer: { kycStatus: "PENDING" } });
    expect(await holdOrderProvisioningIfNeeded(tx, "ord-1", { performedBy: "x" })).toEqual(["KYC"]);
    expect(mocks.emitEvent).not.toHaveBeenCalled();
  });

  it("holds an order under fraud review even outside KYC categories", async () => {
    const { tx } = store({ fraudCheck: { status: "REVIEW" }, product: { name: "Hosting", category: { slug: "hosting" } } });
    expect(await holdOrderProvisioningIfNeeded(tx, "ord-1", { performedBy: "x" })).toEqual(["FRAUD_REVIEW"]);
  });

  it("does nothing for a free order or one that already has a service", async () => {
    const free = store({ customer: { kycStatus: "APPROVED" }, fraudCheck: { status: "PASSED" } });
    expect(await holdOrderProvisioningIfNeeded(free.tx, "ord-1", { performedBy: "x" })).toEqual([]);
    expect(free.state.order.provisioningHeldAt).toBeNull();

    const existing = store({ serviceId: "svc-9" });
    expect(await holdOrderProvisioningIfNeeded(existing.tx, "ord-1", { performedBy: "x" })).toEqual([]);
  });
});

describe("releaseHeldOrder", () => {
  it("keeps the hold (with refreshed reasons) while something still blocks", async () => {
    const { state, client } = store({
      provisioningHeldAt: new Date(),
      provisioningHoldReasons: ["FRAUD_REVIEW", "KYC"],
      fraudCheck: { status: "APPROVED" },
      customer: { kycStatus: "PENDING" },
    });
    const result = await releaseHeldOrder("ord-1", "admin-1", { client: client as never, kycConfig: KYC });

    expect(result).toEqual({ released: false, reasons: ["KYC"] });
    expect(state.order.provisioningHoldReasons).toEqual(["KYC"]);
    expect(mocks.prepareOrderProvisioning).not.toHaveBeenCalled();
  });

  it("releases exactly once into the normal provisioning path", async () => {
    const { state, client } = store({
      status: "PROCESSING",
      provisioningHeldAt: new Date(),
      provisioningHoldReasons: ["KYC"],
      fraudCheck: { status: "PASSED" },
      customer: { kycStatus: "APPROVED" },
    });

    const first = await releaseHeldOrder("ord-1", "admin-1", { client: client as never, kycConfig: KYC });
    const second = await releaseHeldOrder("ord-1", "admin-1", { client: client as never, kycConfig: KYC });

    expect(first).toMatchObject({ released: true });
    expect(second).toMatchObject({ released: false, notHeld: true });
    expect(mocks.prepareOrderProvisioning).toHaveBeenCalledTimes(1);
    expect(state.order).toMatchObject({ status: "COMPLETED", provisioningHeldAt: null, provisioningHoldReasons: [] });
    expect(state.activities.map((a) => a.action)).toEqual(["PROVISIONING_RELEASED"]);
  });

  it("releases every held order of a customer after KYC approval", async () => {
    const { client } = store({
      provisioningHeldAt: new Date(),
      provisioningHoldReasons: ["KYC"],
      customer: { kycStatus: "APPROVED" },
    });
    Object.assign(mocks.db, client);
    expect(await releaseHeldOrdersForCustomer("cus-1", "admin-1")).toEqual({ held: 1, released: 1 });
    expect(mocks.prepareOrderProvisioning).toHaveBeenCalledTimes(1);
  });
});
