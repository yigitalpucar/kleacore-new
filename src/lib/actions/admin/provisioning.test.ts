import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  manualRetryProvisioningJob: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("@/lib/utils/auth-helpers", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/activity-log", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/provisioning/retry-queue", () => ({
  manualRetryProvisioningJob: mocks.manualRetryProvisioningJob,
}));
vi.mock("@/lib/db", () => ({ db: { provisioningJob: { findUnique: mocks.findUnique } } }));

import { retryProvisioningJobAction } from "./provisioning";

describe("retryProvisioningJobAction", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockResolvedValue({ user: { id: "admin_1" } });
    mocks.findUnique.mockResolvedValue({ id: "job_1", order: { orderNumber: "ORD-1" } });
  });

  it("logs the underlying error instead of swallowing it", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.manualRetryProvisioningJob.mockRejectedValue(new Error("WHM timeout"));

    const result = await retryProvisioningJobAction("job_1");

    expect(result).toEqual({
      success: false,
      error: "Provisioning yeniden denenirken bir hata oluştu",
    });
    const entry = JSON.parse(spy.mock.calls[0][0] as string);
    expect(entry).toMatchObject({
      scope: "admin.provisioning",
      level: "error",
      error: { message: "WHM timeout" },
    });
  });
});
