import { describe, expect, it, vi } from "vitest";
import { withAdvisoryLock } from "./lock";

function fakeClient(locked: boolean) {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    end: vi.fn().mockResolvedValue(undefined),
    query: vi.fn(async (sql: string) => (sql.includes("pg_try_advisory_lock") ? { rows: [{ locked }] } : { rows: [] })),
  };
}

describe("withAdvisoryLock", () => {
  it("runs the job, then unlocks and closes its own connection", async () => {
    const client = fakeClient(true);
    const fn = vi.fn().mockResolvedValue("done");

    const result = await withAdvisoryLock("daily-billing", fn, () => client as never);

    expect(result).toEqual({ acquired: true, value: "done" });
    expect(client.query.mock.calls[0]).toEqual([
      "SELECT pg_try_advisory_lock(hashtext($1), hashtext($2)) AS locked",
      ["kleacore:cron", "daily-billing"],
    ]);
    expect(client.query.mock.calls[1][0]).toContain("pg_advisory_unlock");
    expect(client.end).toHaveBeenCalled();
  });

  it("does not run the job when the lock is held elsewhere", async () => {
    const client = fakeClient(false);
    const fn = vi.fn();

    await expect(withAdvisoryLock("daily-billing", fn, () => client as never)).resolves.toEqual({ acquired: false });
    expect(fn).not.toHaveBeenCalled();
    expect(client.end).toHaveBeenCalled();
  });

  it("releases the lock when the job throws", async () => {
    const client = fakeClient(true);

    await expect(
      withAdvisoryLock("daily-billing", async () => {
        throw new Error("boom");
      }, () => client as never)
    ).rejects.toThrow("boom");
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes("pg_advisory_unlock"))).toBe(true);
    expect(client.end).toHaveBeenCalled();
  });
});
