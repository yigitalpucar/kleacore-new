import { fromPrisma, type PrismaTransactionLike } from "pg-boss";
import { getBoss } from "./boss";
import { jobRegistry, type JobName, type JobPayload } from "./definitions";

export interface EnqueueOptions {
  /**
   * Idempotency key. On an `exclusive` queue a second enqueue with the same
   * key is dropped while a job with that key is queued, waiting for a retry
   * or running. On a `singleton` queue it is a concurrency group (one active
   * job per key, the rest wait). Rejected on `standard` queues, where it
   * would silently not deduplicate.
   */
  singletonKey?: string;
  /** Run no earlier than this date, or this many seconds from now. */
  startAfter?: Date | number;
  retryLimit?: number;
  retryDelay?: number;
  retryBackoff?: boolean;
  retryDelayMax?: number;
  priority?: number;
  /**
   * Prisma transaction (or client) to insert the job with. Passing the
   * interactive transaction makes the job commit or roll back together with
   * the business rows that need it (transactional outbox).
   */
  tx?: PrismaTransactionLike;
}

export interface EnqueueResult {
  /** pg-boss job id; null when the singletonKey deduplicated the send. */
  id: string | null;
  deduplicated: boolean;
}

export async function enqueue<N extends JobName>(
  name: N,
  payload: JobPayload<N>,
  options: EnqueueOptions = {}
): Promise<EnqueueResult> {
  const definition = jobRegistry.get(name);
  const data = jobRegistry.parse(name, payload) as object;

  if (options.singletonKey && definition.queue.policy !== "exclusive" && definition.queue.policy !== "singleton") {
    throw new Error(`Job "${name}" uses the ${definition.queue.policy} policy; singletonKey would not deduplicate`);
  }

  const { tx, startAfter, ...sendOptions } = options;
  const boss = await getBoss();
  const id = await boss.send(name, data, {
    ...sendOptions,
    ...(startAfter !== undefined ? { startAfter } : {}),
    ...(tx ? { db: fromPrisma(tx) } : {}),
  });

  return { id, deduplicated: id === null };
}
