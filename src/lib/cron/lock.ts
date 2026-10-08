import { Client } from "pg";

/** First key of the two-int advisory lock; the job name hashes into the second. */
const LOCK_NAMESPACE = "kleacore:cron";

export type LockedResult<T> = { acquired: true; value: T } | { acquired: false };

type LockClient = Pick<Client, "connect" | "query" | "end">;

function createClient(): LockClient {
  return new Client({
    connectionString: process.env.DATABASE_URL,
    application_name: "kleacore-cron-lock",
  });
}

/**
 * Runs `fn` while holding a session-level Postgres advisory lock for `key`,
 * or returns `{ acquired: false }` immediately if another process holds it.
 *
 * Uses its own connection (not the Prisma pool): a session lock must be taken
 * and released on the same connection, and if the process dies the closed
 * connection releases the lock, so a crashed run can never wedge the job.
 */
export async function withAdvisoryLock<T>(
  key: string,
  fn: () => Promise<T>,
  clientFactory: () => LockClient = createClient
): Promise<LockedResult<T>> {
  const client = clientFactory();
  await client.connect();

  try {
    const { rows } = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock(hashtext($1), hashtext($2)) AS locked",
      [LOCK_NAMESPACE, key]
    );

    if (!rows[0]?.locked) {
      return { acquired: false };
    }

    try {
      return { acquired: true, value: await fn() };
    } finally {
      await client
        .query("SELECT pg_advisory_unlock(hashtext($1), hashtext($2))", [LOCK_NAMESPACE, key])
        .catch(() => {});
    }
  } finally {
    await client.end().catch(() => {});
  }
}
