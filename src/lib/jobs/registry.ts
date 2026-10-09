import type { z } from "zod";

/**
 * Typed job registry: job name → payload zod schema → handler.
 *
 * Kept free of pg-boss / Prisma imports so it can be validated in unit tests
 * and imported from anywhere without opening a database connection.
 */

/**
 * pg-boss queue policies we use. `exclusive` allows at most one queued
 * (created/retry) or active job per `singletonKey`, which is what makes
 * `enqueue(..., { singletonKey })` idempotent. `standard` has no dedupe.
 * `singleton` allows one *active* job per `singletonKey` and any number
 * queued: a concurrency limit (e.g. one vzdump per Proxmox node), not dedupe.
 */
export type JobPolicy = "standard" | "exclusive" | "singleton";

export interface JobQueueOptions {
  policy?: JobPolicy;
  /** Retries after the first attempt (total attempts = retryLimit + 1). */
  retryLimit?: number;
  /** Seconds before the first retry. */
  retryDelay?: number;
  /** Exponential backoff based on `retryDelay`. */
  retryBackoff?: boolean;
  /** Upper bound for the backoff delay, in seconds. */
  retryDelayMax?: number;
  /** Seconds a job may stay active before pg-boss treats it as crashed. */
  expireInSeconds?: number;
}

export interface JobContext {
  jobId: string;
  /** 0 on the first attempt. */
  retryCount: number;
  retryLimit: number;
  /** True when a failure of this attempt makes the job terminally failed. */
  isFinalAttempt: boolean;
}

export interface JobDefinition<N extends string = string, S extends z.ZodTypeAny = z.ZodTypeAny> {
  name: N;
  /** Turkish label for the admin screen. */
  label: string;
  schema: S;
  queue: JobQueueOptions;
  // Method syntax keeps concrete definitions assignable to JobDefinition<string>.
  handler(payload: z.output<S>, context: JobContext): Promise<unknown>;
}

export class UnknownJobError extends Error {
  constructor(name: string) {
    super(`Unknown job: ${name}`);
    this.name = "UnknownJobError";
  }
}

export class InvalidJobPayloadError extends Error {
  constructor(
    name: string,
    readonly issues: z.ZodIssue[]
  ) {
    super(`Invalid payload for job ${name}: ${issues.map((i) => `${i.path.join(".") || "(root)"} ${i.message}`).join("; ")}`);
    this.name = "InvalidJobPayloadError";
  }
}

/** pg-boss accepts letters, digits, `.`, `-`, `_`, `/`; we keep names lower-case and dotted. */
const JOB_NAME_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;

export function defineJob<const N extends string, S extends z.ZodTypeAny>(
  definition: Omit<JobDefinition<N, S>, "queue"> & { queue?: JobQueueOptions }
): JobDefinition<N, S> {
  return { ...definition, queue: { policy: "standard", ...definition.queue } };
}

export interface JobRegistry<D extends JobDefinition = JobDefinition> {
  names(): string[];
  all(): D[];
  get(name: string): D;
  has(name: string): boolean;
  /** Validates and normalises a payload with the job's schema. */
  parse(name: string, payload: unknown): unknown;
}

/**
 * Builds a registry and validates it eagerly, so a misconfigured job fails at
 * import time (and in tests) rather than when the first job is enqueued.
 */
export function createRegistry<D extends JobDefinition>(definitions: readonly D[]): JobRegistry<D> {
  const byName = new Map<string, D>();

  for (const definition of definitions) {
    if (!JOB_NAME_PATTERN.test(definition.name)) {
      throw new Error(`Invalid job name "${definition.name}" (expected lower-case dotted, e.g. "provisioning.run")`);
    }
    if (byName.has(definition.name)) {
      throw new Error(`Duplicate job name "${definition.name}"`);
    }
    if (typeof definition.handler !== "function") {
      throw new Error(`Job "${definition.name}" has no handler`);
    }
    const { retryLimit, retryDelay, retryDelayMax, expireInSeconds } = definition.queue;
    for (const [key, value] of Object.entries({ retryLimit, retryDelay, retryDelayMax })) {
      if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
        throw new Error(`Job "${definition.name}": ${key} must be a non-negative integer`);
      }
    }
    if (expireInSeconds !== undefined && (!Number.isInteger(expireInSeconds) || expireInSeconds < 1)) {
      throw new Error(`Job "${definition.name}": expireInSeconds must be >= 1`);
    }
    byName.set(definition.name, definition);
  }

  const get = (name: string) => {
    const definition = byName.get(name);
    if (!definition) throw new UnknownJobError(name);
    return definition;
  };

  return {
    names: () => [...byName.keys()],
    all: () => [...byName.values()],
    get,
    has: (name) => byName.has(name),
    parse(name, payload) {
      const result = get(name).schema.safeParse(payload);
      if (!result.success) throw new InvalidJobPayloadError(name, result.error.issues);
      return result.data;
    },
  };
}
