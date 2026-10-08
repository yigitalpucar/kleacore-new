import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  productFindUnique: vi.fn(),
  serviceCreate: vi.fn(),
  serviceUpdate: vi.fn(),
  createRemoteService: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: mocks.userFindUnique },
    product: { findUnique: mocks.productFindUnique },
    service: { create: mocks.serviceCreate, update: mocks.serviceUpdate },
  },
}));
vi.mock("@/lib/utils/auth-helpers", () => ({
  requirePermission: vi.fn().mockResolvedValue({ user: { id: "admin-1" } }),
}));
vi.mock("@/lib/integrations/provisioning-provider", () => ({
  createRemoteService: mocks.createRemoteService,
  suspendRemoteService: vi.fn(),
  terminateRemoteService: vi.fn(),
  unsuspendRemoteService: vi.fn(),
}));
vi.mock("@/lib/notifications/email", () => ({
  dispatchNotification: vi.fn(),
  loadCustomerRecipient: vi.fn(),
  sendServiceSuspendedEmail: vi.fn(),
}));
vi.mock("@/lib/activity-log", () => ({ logActivity: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createService } from "./services";

describe("createService (admin hizmet ekle)", () => {
  beforeEach(() => {
    mocks.userFindUnique.mockResolvedValue({ id: "cus-1" });
    mocks.productFindUnique.mockResolvedValue({
      id: "prd-starter",
      basePrice: 49,
      category: { slug: "hosting" },
      pricingTiers: [
        { period: "monthly", price: 49, isDefault: true },
        { period: "yearly", price: 39, isDefault: false },
      ],
    });
    mocks.serviceCreate.mockImplementation(async ({ data }) => ({ id: "svc-1", ...data }));
    mocks.createRemoteService.mockResolvedValue({ ok: true, skipped: true });
  });

  it("stores the yearly total for a yearly hosting service", async () => {
    const result = await createService({
      customerId: "cus-1",
      productId: "prd-starter",
      billingPeriod: "yearly",
    });

    expect(result.success).toBe(true);
    expect(mocks.serviceCreate.mock.calls[0][0].data).toMatchObject({
      billingPeriod: "yearly",
      amount: 468,
    });
  });

  it("stores the monthly price for a monthly service", async () => {
    await createService({ customerId: "cus-1", productId: "prd-starter", billingPeriod: "monthly" });

    expect(mocks.serviceCreate.mock.calls[0][0].data.amount).toBe(49);
  });

  it("keeps an explicitly given amount", async () => {
    await createService({
      customerId: "cus-1",
      productId: "prd-starter",
      billingPeriod: "yearly",
      amount: 400,
    });

    expect(mocks.serviceCreate.mock.calls[0][0].data.amount).toBe(400);
  });
});
