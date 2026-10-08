import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/notifications/send", () => ({ sendNotification: vi.fn() }));

import type { ImportRow, Prisma } from "@prisma/client";
import { ImportRowError, applyRows, claimExistingIps, rowErrorMessage } from "./apply";

const NOW = new Date("2026-10-08T09:00:00Z");

function row(id: string): ImportRow {
  return { id, remoteId: id } as ImportRow;
}

describe("applyRows", () => {
  it("records a failing row and keeps going", async () => {
    const recorded: Array<{ id: string; status?: string; error?: string }> = [];
    const result = await applyRows(
      [row("a"), row("b"), row("c")],
      async (r) => {
        if (r.id === "b") throw new ImportRowError("Ürün seçilmedi.");
        if (r.id === "c") throw new Error("connection reset with secret-ish detail");
        return { status: "IMPORTED", serviceId: `svc_${r.id}`, customerId: "u_new", createdCustomer: true };
      },
      async (r, { outcome, error }) => {
        recorded.push({ id: r.id, status: outcome?.status, error });
      }
    );

    expect(recorded).toEqual([
      { id: "a", status: "IMPORTED", error: undefined },
      { id: "b", status: undefined, error: "Ürün seçilmedi." },
      // unexpected errors are not echoed to the admin screen
      { id: "c", status: undefined, error: "Beklenmeyen hata (ayrıntı sunucu günlüğünde)." },
    ]);
    expect([...result.createdCustomers]).toEqual(["u_new"]);
  });

  it("maps validation errors to a readable message", () => {
    const zodLike = Object.assign(new Error("x"), { name: "ZodError" });
    expect(rowErrorMessage(zodLike)).toMatch(/eşlemesi geçersiz/);
  });
});

describe("claimExistingIps", () => {
  function fakeTx(addresses: Record<string, { id: string; status: "FREE" | "ASSIGNED" | "RESERVED"; serviceId: string | null }>) {
    const updates: unknown[] = [];
    const tx = {
      ipAddress: {
        findUnique: vi.fn(async ({ where }: { where: { address: string } }) => addresses[where.address] ?? null),
        updateMany: vi.fn(async (args: { where: { id: string; status: string } }) => {
          updates.push(args);
          const entry = Object.values(addresses).find((a) => a.id === args.where.id);
          return { count: entry?.status === args.where.status ? 1 : 0 };
        }),
      },
    };
    return { tx: tx as unknown as Prisma.TransactionClient, updates };
  }

  it("claims FREE pool addresses, ignores unknown ones and never reassigns", async () => {
    const { tx, updates } = fakeTx({
      "203.0.113.40": { id: "ip40", status: "FREE", serviceId: null },
      "203.0.113.41": { id: "ip41", status: "ASSIGNED", serviceId: "svc_other" },
      "203.0.113.42": { id: "ip42", status: "RESERVED", serviceId: null },
      "203.0.113.43": { id: "ip43", status: "ASSIGNED", serviceId: "svc_new" },
    });

    const warnings = await claimExistingIps(tx, "svc_new", ["203.0.113.40", "203.0.113.41", "203.0.113.42", "203.0.113.43", "198.51.100.9"], NOW);

    expect(updates).toEqual([
      {
        where: { id: "ip40", status: "FREE" },
        data: { status: "ASSIGNED", serviceId: "svc_new", assignedAt: NOW, releasedAt: null, cooldownUntil: null },
      },
    ]);
    expect(warnings).toEqual([
      "203.0.113.41 başka bir hizmete atanmış; değiştirilmedi.",
      "203.0.113.42 havuzda ayrılmış (RESERVED); değiştirilmedi.",
    ]);
  });
});
