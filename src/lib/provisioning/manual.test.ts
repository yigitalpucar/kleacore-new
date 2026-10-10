import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.ENCRYPTION_KEY = "test-encryption-key-test-encryption-key";

const mocks = vi.hoisted(() => ({
  settings: new Map<string, string>(),
  cpanelConfigured: false,
  vpsConfigured: false,
  sendNotification: vi.fn(),
  queueServiceActivatedNotice: vi.fn(),
  queueServiceDnsSetup: vi.fn(),
  tx: {
    provisioningJob: { findUnique: vi.fn(), updateMany: vi.fn(), upsert: vi.fn() },
    service: { findUnique: vi.fn(), update: vi.fn() },
    orderActivity: { create: vi.fn() },
    user: { findMany: vi.fn() },
    notification: { createMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({
  db: { $transaction: (fn: (tx: unknown) => unknown) => fn(mocks.tx) },
}));
vi.mock("@/lib/integrations/settings", () => ({
  getSettingValue: async (key: string, _env?: string, fallback = "") => mocks.settings.get(key) ?? fallback,
}));
vi.mock("@/lib/integrations/provisioning/config", () => ({
  getCpanelWhmConfig: async () => ({}),
  getVpsVdsConfig: async () => ({}),
  isCpanelWhmConfigured: () => mocks.cpanelConfigured,
  isVpsVdsConfigured: () => mocks.vpsConfigured,
}));
vi.mock("@/lib/notifications/send", () => ({ sendNotification: mocks.sendNotification }));
vi.mock("@/lib/dns/activation", () => ({ queueServiceDnsSetup: mocks.queueServiceDnsSetup }));
vi.mock("./activation-notice", () => ({
  activationKindForCategory: (slug: string) => (slug === "hosting" ? "hosting" : "server"),
  queueServiceActivatedNotice: mocks.queueServiceActivatedNotice,
}));

import { decryptSecret, isEncryptedValue } from "@/lib/secrets/crypto";
import {
  ManualProvisioningError,
  activateManualProvisioning,
  openManualProvisioningTask,
  requiresManualProvisioning,
} from "./manual";
import { formatWaiting, slaState } from "./sla";

describe("requiresManualProvisioning", () => {
  beforeEach(() => {
    mocks.settings.clear();
    mocks.cpanelConfigured = false;
    mocks.vpsConfigured = false;
  });

  it("treats VDS as manual by default (Faz 1), even with a configured VPS module", async () => {
    mocks.vpsConfigured = true;
    expect(await requiresManualProvisioning("vds")).toBe(true);
    expect(await requiresManualProvisioning("vps")).toBe(false);
  });

  it("falls back to manual when the category's module is not configured", async () => {
    expect(await requiresManualProvisioning("hosting")).toBe(true);
    expect(await requiresManualProvisioning("vps")).toBe(true);
    mocks.cpanelConfigured = true;
    expect(await requiresManualProvisioning("hosting")).toBe(false);
  });

  it("never turns domain/SSL orders into manual tasks; unknown service categories are manual", async () => {
    expect(await requiresManualProvisioning("domain")).toBe(false);
    expect(await requiresManualProvisioning("ssl")).toBe(false);
    expect(await requiresManualProvisioning("datacenter")).toBe(true);
  });

  it("honours manual_provisioning_categories", async () => {
    mocks.vpsConfigured = true;
    mocks.settings.set("manual_provisioning_categories", "vps, cloud");
    expect(await requiresManualProvisioning("vds")).toBe(false);
    expect(await requiresManualProvisioning("cloud")).toBe(true);
  });
});

describe("openManualProvisioningTask", () => {
  beforeEach(() => {
    mocks.settings.clear();
    mocks.tx.provisioningJob.upsert.mockResolvedValue({ id: "task-1" });
    mocks.tx.user.findMany.mockResolvedValue([{ id: "admin-1" }]);
  });

  it("creates the MANUAL task and notifies staff by mail and in-app, inside the payment transaction", async () => {
    mocks.settings.set("support_email", "destek@kleacore.com");
    const task = await openManualProvisioningTask(mocks.tx as never, {
      orderId: "o1",
      orderNumber: "S-1",
      serviceId: "s1",
      productName: "VDS Pro",
      customerName: "Ayşe Yılmaz",
      customerEmail: "ayse@example.com",
    });

    expect(task.id).toBe("task-1");
    expect(mocks.tx.provisioningJob.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { orderId: "o1" },
        update: {},
        create: expect.objectContaining({ kind: "MANUAL", status: "PENDING", serviceId: "s1" }),
      })
    );
    expect(mocks.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        template: "admin.manual-provisioning",
        to: "destek@kleacore.com",
        dedupeKey: "manual-provisioning:task-1",
        tx: mocks.tx,
        data: expect.objectContaining({ taskId: "task-1", slaHours: 24 }),
      })
    );
    expect(mocks.tx.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: "admin-1",
          link: "/yonetim/kurulumlar/task-1",
          kind: "provisioning.manual_pending",
          dedupeKey: "manual-provisioning:task-1",
        }),
      ],
      skipDuplicates: true,
    });
  });
});

describe("activateManualProvisioning", () => {
  const task = { id: "task-1", kind: "MANUAL", serviceId: "s1", order: { id: "o1", orderNumber: "S-1", serviceId: "s1" } };
  const service = {
    id: "s1",
    customerId: "c1",
    status: "PENDING",
    billingPeriod: "monthly",
    expiresAt: null,
    nextDueDate: null,
    ipAddress: null,
    serverName: null,
    username: "s1user",
    product: { name: "VDS Pro", category: { slug: "vds" } },
  };

  beforeEach(() => {
    mocks.tx.provisioningJob.findUnique.mockResolvedValue(task);
    mocks.tx.provisioningJob.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.service.findUnique.mockResolvedValue(service);
    mocks.tx.service.update.mockImplementation(async ({ data }: { data: object }) => ({ ...service, ...data }));
  });

  it("stores the password encrypted, activates the service from today and queues the customer mail", async () => {
    const before = Date.now();
    const result = await activateManualProvisioning(
      "task-1",
      { ipAddress: "203.0.113.10", hostname: "vds1.kleacore.com", username: "root", password: "S3cret-Pass", passwordDelivery: "included" },
      "admin-1"
    );

    expect(result).toEqual({ serviceId: "s1", orderId: "o1", orderNumber: "S-1" });

    const claim = mocks.tx.provisioningJob.updateMany.mock.calls[0][0];
    expect(claim.where).toEqual({ id: "task-1", status: { in: ["PENDING", "PROCESSING", "FAILED"] } });
    const details = claim.data.deliveryDetails;
    expect(isEncryptedValue(details.passwordEncrypted)).toBe(true);
    expect(decryptSecret(details.passwordEncrypted)).toBe("S3cret-Pass");
    expect(JSON.stringify(claim)).not.toContain("S3cret-Pass");

    const serviceUpdate = mocks.tx.service.update.mock.calls[0][0].data;
    expect(serviceUpdate).toMatchObject({ status: "ACTIVE", ipAddress: "203.0.113.10", serverName: "vds1.kleacore.com", username: "root" });
    expect(serviceUpdate.expiresAt.getTime()).toBeGreaterThan(before + 27 * 24 * 60 * 60 * 1000);

    expect(mocks.queueServiceActivatedNotice).toHaveBeenCalledWith(
      mocks.tx,
      expect.objectContaining({ kind: "server", password: "S3cret-Pass", passwordDelivery: "included" })
    );
    // DNS hook rides the same transaction (VDS hostname → A record when the domain is ours).
    expect(mocks.queueServiceDnsSetup).toHaveBeenCalledWith(
      mocks.tx,
      expect.objectContaining({ id: "s1", ipAddress: "203.0.113.10", serverName: "vds1.kleacore.com" }),
      "vds"
    );
  });

  it("does not send a password when it was delivered separately", async () => {
    await activateManualProvisioning(
      "task-1",
      { ipAddress: "203.0.113.10", password: "ignored", passwordDelivery: "separately" },
      "admin-1"
    );
    expect(mocks.tx.provisioningJob.updateMany.mock.calls[0][0].data.deliveryDetails.passwordEncrypted).toBeNull();
    expect(mocks.queueServiceActivatedNotice.mock.calls[0][1].password).toBeUndefined();
  });

  it("requires a password unless it is delivered separately", async () => {
    await expect(activateManualProvisioning("task-1", { passwordDelivery: "included" }, "admin-1")).rejects.toThrow(
      /İlk şifreyi girin/
    );
  });

  it("activates once: a second click finds the task already completed", async () => {
    mocks.tx.provisioningJob.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      activateManualProvisioning("task-1", { passwordDelivery: "separately" }, "admin-1")
    ).rejects.toEqual(new ManualProvisioningError("TASK_NOT_PENDING"));
    expect(mocks.tx.service.update).not.toHaveBeenCalled();
    expect(mocks.queueServiceActivatedNotice).not.toHaveBeenCalled();
  });
});

describe("SLA helpers", () => {
  it("grades waiting time against the target", () => {
    const hour = 60 * 60 * 1000;
    expect(slaState(2 * hour, 24)).toBe("ok");
    expect(slaState(13 * hour, 24)).toBe("warning");
    expect(slaState(25 * hour, 24)).toBe("breached");
  });

  it("formats waiting time in Turkish units", () => {
    expect(formatWaiting(45 * 60_000)).toBe("45 dk");
    expect(formatWaiting(192 * 60_000)).toBe("3 sa 12 dk");
    expect(formatWaiting((2 * 24 + 4) * 60 * 60_000)).toBe("2 gün 4 sa");
  });
});
