import { describe, expect, it } from "vitest";
import {
  appendIncidentUpdate,
  incidentCreateSchema,
  incidentUpdateSchema,
  maintenanceDescription,
  maintenanceWindowSchema,
  nextResolvedAt,
  normaliseUpdates,
  statusComponentSchema,
} from "./system-status";

describe("statusComponentSchema", () => {
  it("accepts a valid component and trims the name", () => {
    const r = statusComponentSchema.parse({ serviceName: "  Web Hosting ", status: "OPERATIONAL" });
    expect(r).toEqual({ serviceName: "Web Hosting", status: "OPERATIONAL", description: "" });
  });

  it("rejects short names and unknown statuses with Turkish messages", () => {
    const short = statusComponentSchema.safeParse({ serviceName: "a", status: "OPERATIONAL" });
    expect(short.success).toBe(false);
    expect(short.error?.errors[0]?.message).toBe("Bileşen adı en az 2 karakter olmalı");

    const bad = statusComponentSchema.safeParse({ serviceName: "DNS", status: "DOWN" });
    expect(bad.success).toBe(false);
    expect(bad.error?.errors[0]?.message).toBe("Geçersiz durum");
  });
});

describe("incidentCreateSchema", () => {
  const base = { title: "E-posta gecikmesi", severity: "MAJOR", status: "INVESTIGATING", serviceName: "E-posta" };

  it("accepts a minimal incident", () => {
    expect(incidentCreateSchema.safeParse(base).success).toBe(true);
  });

  it("requires an affected component and a valid start date", () => {
    expect(incidentCreateSchema.safeParse({ ...base, serviceName: " " }).success).toBe(false);
    expect(incidentCreateSchema.safeParse({ ...base, startedAt: "yarın" }).success).toBe(false);
    expect(incidentCreateSchema.safeParse({ ...base, startedAt: "2026-10-08T10:00:00.000Z" }).success).toBe(true);
  });

  it("rejects unknown severities", () => {
    expect(incidentCreateSchema.safeParse({ ...base, severity: "LOW" }).success).toBe(false);
  });
});

describe("incidentUpdateSchema", () => {
  it("requires a message", () => {
    const r = incidentUpdateSchema.safeParse({ status: "MONITORING", message: "  " });
    expect(r.success).toBe(false);
  });
});

describe("maintenanceWindowSchema", () => {
  it("rejects an end before the start", () => {
    const r = maintenanceWindowSchema.safeParse({ start: "2026-10-10T02:00:00Z", end: "2026-10-10T01:00:00Z" });
    expect(r.success).toBe(false);
    expect(r.error?.errors[0]?.path).toEqual(["end"]);
  });

  it("formats the window in Istanbul time", () => {
    const text = maintenanceDescription("2026-10-09T23:00:00Z", "2026-10-10T01:00:00Z", "Kısa kesinti olabilir.");
    expect(text).toContain("Planlı bakım:");
    expect(text).toContain("10 Ekim 02:00");
    expect(text).toContain("04:00");
    expect(text.endsWith("Kısa kesinti olabilir.")).toBe(true);
  });
});

describe("incident timeline helpers", () => {
  const now = new Date("2026-10-08T12:00:00.000Z");

  it("appends in the shape the public page reads and drops junk", () => {
    const out = appendIncidentUpdate(
      [{ message: "İlk", status: "INVESTIGATING", createdAt: "2026-10-08T11:00:00.000Z" }, "eski", null, { status: "X" }],
      { message: " Düzeldi ", status: "RESOLVED" },
      now
    );
    expect(out).toEqual([
      { message: "İlk", status: "INVESTIGATING", createdAt: "2026-10-08T11:00:00.000Z" },
      { message: "Düzeldi", status: "RESOLVED", createdAt: now.toISOString() },
    ]);
  });

  it("normalises non-arrays to an empty list", () => {
    expect(normaliseUpdates({})).toEqual([]);
  });

  it("sets resolvedAt only for RESOLVED and keeps an existing one", () => {
    const earlier = new Date("2026-10-07T00:00:00.000Z");
    expect(nextResolvedAt("RESOLVED", null, now)).toEqual(now);
    expect(nextResolvedAt("RESOLVED", earlier, now)).toEqual(earlier);
    expect(nextResolvedAt("MONITORING", earlier, now)).toBeNull();
  });
});
