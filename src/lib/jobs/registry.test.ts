import { describe, expect, it } from "vitest";
import { z } from "zod";
import { jobRegistry, PROVISIONING_RUN_JOB } from "./definitions";
import { createRegistry, defineJob, InvalidJobPayloadError, UnknownJobError } from "./registry";

const noop = async () => undefined;

describe("job registry", () => {
  it("rejects duplicate job names", () => {
    const a = defineJob({ name: "mail.send", label: "A", schema: z.object({}), handler: noop });
    expect(() => createRegistry([a, a])).toThrow(/Duplicate job name "mail.send"/);
  });

  it("rejects names pg-boss or our conventions don't accept", () => {
    for (const name of ["Mail.Send", "mail send", "mail..send", ".mail", "mail."]) {
      const job = defineJob({ name, label: "x", schema: z.object({}), handler: noop });
      expect(() => createRegistry([job]), name).toThrow(/Invalid job name/);
    }
  });

  it("rejects invalid retry settings", () => {
    const job = defineJob({ name: "a.b", label: "x", schema: z.object({}), handler: noop, queue: { retryLimit: -1 } });
    expect(() => createRegistry([job])).toThrow(/retryLimit must be a non-negative integer/);
    const expiry = defineJob({ name: "a.c", label: "x", schema: z.object({}), handler: noop, queue: { expireInSeconds: 0 } });
    expect(() => createRegistry([expiry])).toThrow(/expireInSeconds/);
  });

  it("defaults to the standard (non-deduplicating) policy", () => {
    const job = defineJob({ name: "a.b", label: "x", schema: z.object({}), handler: noop });
    expect(job.queue.policy).toBe("standard");
  });

  it("validates payloads with the job schema", () => {
    const registry = createRegistry([
      defineJob({ name: "domain.renew", label: "x", schema: z.object({ domainId: z.string().min(1) }), handler: noop }),
    ]);

    expect(registry.parse("domain.renew", { domainId: "d1" })).toEqual({ domainId: "d1" });
    expect(() => registry.parse("domain.renew", { domainId: "" })).toThrow(InvalidJobPayloadError);
    expect(() => registry.parse("domain.renew", {})).toThrow(/domainId/);
    expect(() => registry.parse("nope", {})).toThrow(UnknownJobError);
  });

  it("registers provisioning.run as an idempotent (exclusive) queue with 5 attempts", () => {
    const definition = jobRegistry.get(PROVISIONING_RUN_JOB);
    expect(definition.queue).toMatchObject({ policy: "exclusive", retryLimit: 4, retryBackoff: true });
    expect(() => jobRegistry.parse(PROVISIONING_RUN_JOB, { provisioningJobId: "pj-1", extra: 1 })).toThrow(
      InvalidJobPayloadError
    );
  });
});
