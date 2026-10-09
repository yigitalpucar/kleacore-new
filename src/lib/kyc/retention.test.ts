import { describe, expect, it, vi } from "vitest";

type Doc = { id: string; userId?: string; storageDriver: string; storageKey: string; deleteAfter: Date | null; deletedAt: Date | null };
type Svc = { status: string; cancelledAt: Date | null; expiresAt: Date | null; updatedAt: Date };
type Customer = { id: string; kycStatus: string; kycReviewedAt: Date | null; services: Svc[] };

const mocks = vi.hoisted(() => ({ docs: [] as Doc[], customers: [] as Customer[] }));

vi.mock("@/lib/db", () => ({
  db: {
    kycDocument: {
      findMany: vi.fn(async ({ where }: { where: { deleteAfter: { lte: Date } } }) =>
        mocks.docs
          .filter((doc) => doc.deletedAt === null && doc.deleteAfter !== null && doc.deleteAfter <= where.deleteAfter.lte)
          .map(({ id, storageDriver, storageKey }) => ({ id, storageDriver, storageKey }))
      ),
      updateMany: vi.fn(async ({ where, data }: { where: { id: string; deletedAt: null }; data: { deletedAt: Date } }) => {
        await Promise.resolve();
        const doc = mocks.docs.find((item) => item.id === where.id && item.deletedAt === null);
        if (!doc) return { count: 0 };
        doc.deletedAt = data.deletedAt;
        return { count: 1 };
      }),
    },
    user: {
      // Approved customers with live (no deleteAfter, not deleted) documents.
      findMany: vi.fn(async () =>
        mocks.customers
          .filter((c) => c.kycStatus === "APPROVED")
          .map((c) => ({
            ...c,
            kycDocuments: mocks.docs
              .filter((d) => d.userId === c.id && d.deletedAt === null && d.deleteAfter === null)
              .map(({ id, storageDriver, storageKey }) => ({ id, storageDriver, storageKey })),
          }))
          .filter((c) => c.kycDocuments.length > 0)
      ),
    },
  },
}));

import type { StorageDriver } from "@/lib/storage";
import type { KycConfig } from "./settings";
import { approvedRetentionUntil, runKycRetention } from "./retention";

const CONFIG: KycConfig = { requiredCategories: ["vds", "server", "datacenter"], rejectedRetentionDays: 30, approvedRetentionDaysAfterServiceEnd: 730 };
const config = async () => CONFIG;
const NO_APPROVED = { customers: 0, deleted: 0, failed: 0 };

const NOW = new Date("2026-11-10T03:45:00Z");

function seed() {
  mocks.customers = [];
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

    const first = await runKycRetention(NOW, () => instance, config);
    const second = await runKycRetention(NOW, () => instance, config);

    expect(first).toEqual({ processed: 2, deleted: 2, failed: 0, approved: NO_APPROVED });
    expect(second).toEqual({ processed: 0, deleted: 0, failed: 0, approved: NO_APPROVED });
    expect(deleted).toEqual(["kyc/2026/10/a", "kyc/2026/10/b"]);
    expect(mocks.docs.filter((doc) => doc.deletedAt).map((doc) => doc.id)).toEqual(["due-1", "due-2"]);
  });

  it("counts a document once when two runs overlap", async () => {
    seed();
    const { instance } = driver();
    const results = await Promise.all([runKycRetention(NOW, () => instance, config), runKycRetention(NOW, () => instance, config)]);
    expect(results.reduce((sum, r) => sum + r.deleted, 0)).toBe(2);
  });

  it("leaves a file whose delete failed for the next run", async () => {
    seed();
    const failing = driver(["kyc/2026/10/a"]);
    expect(await runKycRetention(NOW, () => failing.instance, config)).toEqual({ processed: 2, deleted: 1, failed: 1, approved: NO_APPROVED });
    expect(mocks.docs.find((doc) => doc.id === "due-1")?.deletedAt).toBeNull();

    const healthy = driver();
    expect(await runKycRetention(NOW, () => healthy.instance, config)).toEqual({ processed: 1, deleted: 1, failed: 0, approved: NO_APPROVED });
  });
});

describe("approved KYC documents (owner decision: files go 730 days after the last server service ended)", () => {
  const ended = (at: string): Svc => ({ status: "CANCELLED", cancelledAt: new Date(at), expiresAt: null, updatedAt: new Date(at) });
  const running: Svc = { status: "ACTIVE", cancelledAt: null, expiresAt: null, updatedAt: new Date("2024-01-01") };

  function seedApproved() {
    mocks.customers = [
      // Last server ended > 730 days ago → purge.
      { id: "old", kycStatus: "APPROVED", kycReviewedAt: new Date("2023-01-01"), services: [ended("2023-06-01"), ended("2024-10-01")] },
      // Ended 1 year ago → keep.
      { id: "recent", kycStatus: "APPROVED", kycReviewedAt: new Date("2024-01-01"), services: [ended("2025-11-10")] },
      // One server still running (another long ended) → never purged.
      { id: "active", kycStatus: "APPROVED", kycReviewedAt: new Date("2020-01-01"), services: [ended("2021-01-01"), running] },
    ];
    mocks.docs = [
      { id: "old-front", userId: "old", storageDriver: "local", storageKey: "kyc/old/front", deleteAfter: null, deletedAt: null },
      { id: "old-back", userId: "old", storageDriver: "local", storageKey: "kyc/old/back", deleteAfter: null, deletedAt: null },
      { id: "recent-front", userId: "recent", storageDriver: "local", storageKey: "kyc/recent/front", deleteAfter: null, deletedAt: null },
      { id: "active-front", userId: "active", storageDriver: "local", storageKey: "kyc/active/front", deleteAfter: null, deletedAt: null },
    ];
  }

  it("deletes the files (rows kept with deletedAt) only for customers past the retention, idempotently", async () => {
    seedApproved();
    const { instance, deleted } = driver();
    const first = await runKycRetention(NOW, () => instance, config);
    const second = await runKycRetention(NOW, () => instance, config);

    expect(first.approved).toEqual({ customers: 1, deleted: 2, failed: 0 });
    expect(second.approved).toEqual(NO_APPROVED);
    expect(deleted).toEqual(["kyc/old/front", "kyc/old/back"]);
    expect(mocks.docs.filter((doc) => doc.deletedAt).map((doc) => doc.id)).toEqual(["old-front", "old-back"]);
    // The decision record (kycStatus) is untouched.
    expect(mocks.customers.find((c) => c.id === "old")?.kycStatus).toBe("APPROVED");
  });

  it("anchors on the last service end; a running service keeps the documents; no service → approval date", () => {
    expect(approvedRetentionUntil([ended("2024-10-01"), ended("2023-01-01")], null, 730)?.toISOString().slice(0, 10)).toBe("2026-10-01");
    expect(approvedRetentionUntil([ended("2020-01-01"), running], new Date("2019-01-01"), 730)).toBeNull();
    expect(approvedRetentionUntil([], new Date("2025-01-01"), 730)?.toISOString().slice(0, 10)).toBe("2027-01-01");
  });
});
