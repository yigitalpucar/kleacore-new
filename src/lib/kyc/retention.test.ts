import { describe, expect, it, vi } from "vitest";

type Doc = { id: string; storageDriver: string; storageKey: string; deleteAfter: Date | null; deletedAt: Date | null };

const mocks = vi.hoisted(() => ({ docs: [] as Doc[] }));

vi.mock("@/lib/db", () => ({
  db: {
    kycDocument: {
      findMany: vi.fn(async ({ where }: { where: { deleteAfter: { lte: Date } } }) =>
        mocks.docs
          .filter((doc) => doc.deletedAt === null && doc.deleteAfter !== null && doc.deleteAfter <= where.deleteAfter.lte)
          .map(({ id, storageDriver, storageKey }) => ({ id, storageDriver, storageKey }))
      ),
      updateMany: vi.fn(async ({ where, data }: { where: { id: string; deletedAt: null }; data: { deletedAt: Date } }) => {
        const doc = mocks.docs.find((item) => item.id === where.id && item.deletedAt === null);
        if (!doc) return { count: 0 };
        doc.deletedAt = data.deletedAt;
        return { count: 1 };
      }),
    },
  },
}));

import type { StorageDriver } from "@/lib/storage";
import { runKycRetention } from "./retention";

const NOW = new Date("2026-11-10T03:45:00Z");

function seed() {
  mocks.docs = [
    { id: "due-1", storageDriver: "local", storageKey: "kyc/2026/10/a", deleteAfter: new Date("2026-11-09T00:00:00Z"), deletedAt: null },
    { id: "due-2", storageDriver: "local", storageKey: "kyc/2026/10/b", deleteAfter: new Date("2026-11-10T03:00:00Z"), deletedAt: null },
    { id: "later", storageDriver: "local", storageKey: "kyc/2026/10/c", deleteAfter: new Date("2026-12-01T00:00:00Z"), deletedAt: null },
    // Approved documents carry no deleteAfter: never touched.
    { id: "approved", storageDriver: "local", storageKey: "kyc/2026/10/d", deleteAfter: null, deletedAt: null },
  ];
}

function driver(failFor: string[] = []) {
  const deleted: string[] = [];
  const instance = {
    name: "local",
    put: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(async (key: string) => {
      if (failFor.includes(key)) throw new Error("storage unavailable");
      deleted.push(key);
    }),
  } as unknown as StorageDriver;
  return { instance, deleted };
}

describe("runKycRetention", () => {
  it("deletes only due rejected files and is idempotent across runs", async () => {
    seed();
    const { instance, deleted } = driver();

    const first = await runKycRetention(NOW, () => instance);
    const second = await runKycRetention(NOW, () => instance);

    expect(first).toEqual({ processed: 2, deleted: 2, failed: 0 });
    expect(second).toEqual({ processed: 0, deleted: 0, failed: 0 });
    expect(deleted).toEqual(["kyc/2026/10/a", "kyc/2026/10/b"]);
    expect(mocks.docs.filter((doc) => doc.deletedAt).map((doc) => doc.id)).toEqual(["due-1", "due-2"]);
  });

  it("counts a document once when two runs overlap", async () => {
    seed();
    const { instance } = driver();
    const results = await Promise.all([runKycRetention(NOW, () => instance), runKycRetention(NOW, () => instance)]);
    expect(results.reduce((sum, r) => sum + r.deleted, 0)).toBe(2);
  });

  it("leaves a file whose delete failed for the next run", async () => {
    seed();
    const failing = driver(["kyc/2026/10/a"]);
    expect(await runKycRetention(NOW, () => failing.instance)).toEqual({ processed: 2, deleted: 1, failed: 1 });
    expect(mocks.docs.find((doc) => doc.id === "due-1")?.deletedAt).toBeNull();

    const healthy = driver();
    expect(await runKycRetention(NOW, () => healthy.instance)).toEqual({ processed: 1, deleted: 1, failed: 0 });
  });
});
