import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  revalidatePath: vi.fn(),
  logActivity: vi.fn(),
  db: {
    systemStatus: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    systemIncident: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
  },
}));

vi.mock("@/lib/utils/auth-helpers", () => ({ requirePermission: mocks.requirePermission }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/activity-log", () => ({ logActivity: mocks.logActivity }));
vi.mock("@/lib/db", () => ({ db: mocks.db }));

import {
  addIncidentUpdate,
  createIncident,
  createStatusComponent,
  deleteIncident,
  deleteStatusComponent,
} from "./system-status";

const ADMIN = { user: { id: "admin_1", role: "ADMIN" } };

describe("system-status admin actions", () => {
  beforeEach(() => {
    mocks.requirePermission.mockResolvedValue(ADMIN);
  });

  it("stops before touching the database when the caller is not an admin", async () => {
    mocks.requirePermission.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(createStatusComponent({ serviceName: "DNS", status: "OPERATIONAL" })).rejects.toThrow("NEXT_REDIRECT");
    await expect(deleteIncident("x")).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.db.systemStatus.create).not.toHaveBeenCalled();
    expect(mocks.db.systemIncident.delete).not.toHaveBeenCalled();
  });

  it("returns the validation message without writing", async () => {
    const r = await createStatusComponent({ serviceName: "x", status: "OPERATIONAL" });
    expect(r).toEqual({ success: false, error: "Bileşen adı en az 2 karakter olmalı" });
    expect(mocks.db.systemStatus.create).not.toHaveBeenCalled();
  });

  it("creates an incident with a first timeline entry and revalidates both pages", async () => {
    mocks.db.systemIncident.create.mockImplementation(async ({ data }) => ({ id: "inc_1", ...data }));
    const r = await createIncident({
      title: "DNS yanıt vermiyor",
      description: "Bazı bölgelerde çözümleme hatası.",
      severity: "CRITICAL",
      status: "INVESTIGATING",
      serviceName: "DNS",
    });
    expect(r).toEqual({ success: true, data: { id: "inc_1" } });
    const data = mocks.db.systemIncident.create.mock.calls[0][0].data;
    expect(data.resolvedAt).toBeNull();
    expect(data.updates).toHaveLength(1);
    expect(data.updates[0]).toMatchObject({ message: "Bazı bölgelerde çözümleme hatası.", status: "INVESTIGATING" });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/musteri/durum");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/yonetim/durum");
    expect(mocks.logActivity).toHaveBeenCalledWith(expect.objectContaining({ userId: "admin_1", action: "CREATE_INCIDENT" }));
  });

  it("resolving an incident sets resolvedAt and appends the update", async () => {
    mocks.db.systemIncident.findUnique.mockResolvedValue({ id: "inc_1", status: "MONITORING", resolvedAt: null, updates: [] });
    const r = await addIncidentUpdate("inc_1", { status: "RESOLVED", message: "Sorun giderildi." });
    expect(r).toEqual({ success: true });
    const data = mocks.db.systemIncident.update.mock.calls[0][0].data;
    expect(data.status).toBe("RESOLVED");
    expect(data.resolvedAt).toBeInstanceOf(Date);
    expect(data.updates).toHaveLength(1);
  });

  it("refuses to delete a component that still has an open incident", async () => {
    mocks.db.systemStatus.findUnique.mockResolvedValue({ id: "c1", serviceName: "DNS" });
    mocks.db.systemIncident.count.mockResolvedValue(1);
    const r = await deleteStatusComponent("c1");
    expect(r.success).toBe(false);
    expect(mocks.db.systemStatus.delete).not.toHaveBeenCalled();
  });
});
