import { beforeEach, describe, expect, it, vi } from "vitest";

const { send, getBoss } = vi.hoisted(() => {
  const send = vi.fn();
  return { send, getBoss: vi.fn(async () => ({ send })) };
});

vi.mock("./boss", () => ({ getBoss }));
vi.mock("./definitions", async () => {
  const { z } = await import("zod");
  const { createRegistry, defineJob } = await import("./registry");
  const noop = async () => undefined;
  return {
    jobRegistry: createRegistry([
      defineJob({
        name: "provisioning.run",
        label: "p",
        schema: z.object({ provisioningJobId: z.string().min(1) }).strict(),
        queue: { policy: "exclusive" },
        handler: noop,
      }),
      defineJob({ name: "mail.send", label: "m", schema: z.object({ to: z.string().email() }), handler: noop }),
    ]),
  };
});

import { enqueue } from "./enqueue";
import { InvalidJobPayloadError } from "./registry";

describe("enqueue", () => {
  beforeEach(() => {
    send.mockReset();
  });

  it("validates the payload before touching the queue", async () => {
    await expect(enqueue("provisioning.run", { provisioningJobId: "" })).rejects.toBeInstanceOf(InvalidJobPayloadError);
    expect(send).not.toHaveBeenCalled();
  });

  it("is idempotent per singletonKey: a deduplicated send reports deduplicated", async () => {
    send.mockResolvedValueOnce("job-uuid-1").mockResolvedValueOnce(null);

    const first = await enqueue("provisioning.run", { provisioningJobId: "pj-1" }, { singletonKey: "pj-1" });
    const second = await enqueue("provisioning.run", { provisioningJobId: "pj-1" }, { singletonKey: "pj-1" });

    expect(first).toEqual({ id: "job-uuid-1", deduplicated: false });
    expect(second).toEqual({ id: null, deduplicated: true });
    expect(send).toHaveBeenNthCalledWith(1, "provisioning.run", { provisioningJobId: "pj-1" }, { singletonKey: "pj-1" });
  });

  it("refuses a singletonKey on a standard queue, where it would not deduplicate", async () => {
    await expect(enqueue("mail.send" as never, { to: "a@example.com" } as never, { singletonKey: "x" })).rejects.toThrow(
      /would not deduplicate/
    );
    expect(send).not.toHaveBeenCalled();
  });

  it("inserts through the caller's Prisma transaction and forwards retry options", async () => {
    send.mockResolvedValue("job-uuid-2");
    const tx = { $queryRawUnsafe: vi.fn().mockResolvedValue([{ id: "job-uuid-2" }]) };

    await enqueue(
      "provisioning.run",
      { provisioningJobId: "pj-2" },
      { singletonKey: "pj-2", retryLimit: 2, startAfter: 300, tx }
    );

    const options = send.mock.calls[0][2];
    expect(options).toMatchObject({ singletonKey: "pj-2", retryLimit: 2, startAfter: 300 });
    expect(options).not.toHaveProperty("tx");
    // pg-boss runs its INSERT through the adapter, i.e. inside the transaction.
    await options.db.executeSql("SELECT 1", [1]);
    expect(tx.$queryRawUnsafe).toHaveBeenCalledWith("SELECT 1", 1);
  });
});
