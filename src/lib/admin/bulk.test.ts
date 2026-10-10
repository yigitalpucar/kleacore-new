import { beforeEach, describe, expect, it, vi } from "vitest";

const logActivity = vi.fn();
vi.mock("@/lib/activity-log", () => ({ logActivity: (...args: unknown[]) => logActivity(...args) }));

import { BULK_MAX_ITEMS, normalizeBulkIds, runBulk } from "./bulk";

beforeEach(() => {
  logActivity.mockReset();
});

describe("normalizeBulkIds", () => {
  it("keeps unique non-empty string ids in order", () => {
    expect(normalizeBulkIds(["a", " b ", "a", "", 3, null, "c"])).toEqual(["a", "b", "c"]);
    expect(normalizeBulkIds("a")).toEqual([]);
    expect(normalizeBulkIds(["x".repeat(65)])).toEqual([]);
  });
});

describe("runBulk", () => {
  it("runs the single action per id and reports partial failures", async () => {
    const run = vi.fn(async (id: string) =>
      id === "b" ? { success: false, error: "Ödenmiş fatura için hatırlatma gönderilemez" } : { success: true }
    );
    const result = await runBulk(["a", "b", "c", "a"], run, {
      actorId: "staff1",
      activity: { action: "invoice.reminder_sent", entity: "Invoice" },
    });

    expect(run.mock.calls.map((c) => c[0])).toEqual(["a", "b", "c"]);
    expect(result).toEqual({
      success: false,
      total: 3,
      succeeded: 2,
      failed: [{ id: "b", error: "Ödenmiş fatura için hatırlatma gönderilemez" }],
    });
    // One activity row per successful item, sharing a batch id.
    expect(logActivity).toHaveBeenCalledTimes(2);
    const [first, second] = logActivity.mock.calls.map((c) => c[0]);
    expect(first).toMatchObject({ userId: "staff1", action: "invoice.reminder_sent", entity: "Invoice", entityId: "a" });
    expect(second.entityId).toBe("c");
    expect(first.details.batchId).toBe(second.details.batchId);
    expect(first.details.bulk).toBe(true);
  });

  it("turns a thrown error into a failure and keeps going", async () => {
    const run = vi.fn(async (id: string) => {
      if (id === "a") throw new Error("boom");
      return { success: true };
    });
    const result = await runBulk(["a", "b"], run, { actorId: "s" });
    expect(result.succeeded).toBe(1);
    expect(result.failed).toEqual([{ id: "a", error: "Beklenmeyen bir hata oluştu" }]);
    expect(logActivity).not.toHaveBeenCalled(); // no activity option
  });

  it("does not undo a successful item when its activity row fails", async () => {
    logActivity.mockRejectedValueOnce(new Error("db down"));
    const result = await runBulk(["a"], async () => ({ success: true }), {
      actorId: "s",
      activity: { action: "x", entity: "Y" },
    });
    expect(result).toMatchObject({ success: true, succeeded: 1, failed: [] });
  });

  it("refuses empty and oversized selections without running anything", async () => {
    const run = vi.fn(async () => ({ success: true }));
    expect(await runBulk([], run, { actorId: "s" })).toMatchObject({ success: false, error: "Kayıt seçilmedi" });
    const many = Array.from({ length: BULK_MAX_ITEMS + 1 }, (_, i) => `id${i}`);
    expect((await runBulk(many, run, { actorId: "s" })).error).toMatch(/en fazla/);
    expect(run).not.toHaveBeenCalled();
  });
});
