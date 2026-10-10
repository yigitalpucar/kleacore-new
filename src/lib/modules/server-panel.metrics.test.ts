import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getServerBindingForService: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { service: { findUnique: mocks.findUnique, update: mocks.update } } }));
vi.mock("./instances", () => ({ getServerBindingForService: mocks.getServerBindingForService, getInstance: vi.fn() }));
vi.mock("./service-state", () => ({
  createServiceModuleState: vi.fn(() => ({ get: vi.fn(), patch: vi.fn() })),
  moduleSlice: (data: unknown, key: string) =>
    data && typeof data === "object" && !Array.isArray(data) ? ((data as Record<string, Record<string, unknown>>)[key] ?? {}) : {},
  patchServiceModuleState: vi.fn(),
}));

import { getServerLiveStatus, getServiceMetrics, isMetricsRange } from "./server-panel";
import type { ServiceWithProduct } from "@/lib/integrations/provisioning/types";

const base = {
  id: "svc_1",
  label: "Uygulama sunucusu",
  status: "ACTIVE",
  suspendReason: null,
  moduleInstanceId: "mi_pve",
  remoteId: "1000",
  moduleData: {},
  product: { id: "p1", sku: "vds-1", name: "VDS 1", moduleOptions: {}, category: { slug: "vds" } },
} as unknown as ServiceWithProduct;

function binding(getMetrics?: ReturnType<typeof vi.fn>, capabilities: string[] = ["provision", "metrics"]) {
  return {
    manifest: { id: "proxmox", capabilities, productOptionsSchema: undefined },
    instance: { id: "mi_pve", label: "PVE", moduleId: "proxmox", config: {} },
    module: { moduleId: "proxmox", ...(getMetrics ? { getMetrics } : {}) },
  };
}

describe("getServiceMetrics", () => {
  beforeEach(() => {
    mocks.getServerBindingForService.mockReset();
  });

  it("is unavailable for a server without a module or VM (no remote call)", async () => {
    expect(await getServiceMetrics({ ...base, moduleInstanceId: null } as ServiceWithProduct, "hour")).toEqual({ status: "unavailable" });
    expect(await getServiceMetrics({ ...base, remoteId: null } as ServiceWithProduct, "hour")).toEqual({ status: "unavailable" });
    expect(mocks.getServerBindingForService).not.toHaveBeenCalled();
  });

  it("is unavailable when the module does not declare metrics", async () => {
    const getMetrics = vi.fn();
    mocks.getServerBindingForService.mockResolvedValue(binding(getMetrics, ["provision", "usage"]));
    expect(await getServiceMetrics(base, "day")).toEqual({ status: "unavailable" });
    expect(getMetrics).not.toHaveBeenCalled();
  });

  it("returns the module's points for the range", async () => {
    const points = [{ time: 1, cpuPercent: 10 }];
    const getMetrics = vi.fn().mockResolvedValue({ ok: true, provider: "proxmox", data: points });
    mocks.getServerBindingForService.mockResolvedValue(binding(getMetrics));
    expect(await getServiceMetrics(base, "week")).toEqual({ status: "ok", range: "week", points });
    expect(getMetrics).toHaveBeenCalledWith(expect.objectContaining({ service: expect.objectContaining({ remoteId: "1000" }) }), "week");
  });

  it("maps a remote failure or a throw to error, never to fake data", async () => {
    mocks.getServerBindingForService.mockResolvedValue(binding(vi.fn().mockResolvedValue({ ok: false, error: "PROXMOX_METRICS: 500" })));
    expect(await getServiceMetrics(base, "hour")).toEqual({ status: "error" });
    mocks.getServerBindingForService.mockRejectedValue(new Error("MODULE_INSTANCE_NOT_FOUND"));
    expect(await getServiceMetrics(base, "hour")).toEqual({ status: "error" });
  });

  it("validates ranges", () => {
    expect(isMetricsRange("hour")).toBe(true);
    expect(isMetricsRange("month")).toBe(false);
    expect(isMetricsRange(undefined)).toBe(false);
  });
});

describe("getServerLiveStatus", () => {
  it("derives the power state of a legacy (unbound) server from its status", async () => {
    const legacy = { ...base, moduleInstanceId: null, remoteId: null } as ServiceWithProduct;
    expect(await getServerLiveStatus(legacy)).toMatchObject({ status: "ACTIVE", powerState: "running", reinstallPhase: null });
    expect(await getServerLiveStatus({ ...legacy, status: "SUSPENDED" } as ServiceWithProduct)).toMatchObject({ powerState: "stopped" });
  });

  it("reads the stored power state and reinstall phase of a bound server", async () => {
    const fresh = new Date().toISOString();
    const bound = {
      ...base,
      moduleData: { _usage: { collectedAt: fresh, powerState: "stopped" }, proxmox: { reinstall: { phase: "provision" } } },
    } as unknown as ServiceWithProduct;
    expect(await getServerLiveStatus(bound)).toMatchObject({ powerState: "stopped", reinstallPhase: "provision", collectedAt: fresh });
  });
});
