/** A source could not be listed (module unsupported, remote error). Message is admin-facing Turkish. */
export class ImportSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportSourceError";
  }
}

/** Runs `worker` over `items` with at most `limit` in flight; keeps order. */
export async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}
