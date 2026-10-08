import type { Prisma } from "@prisma/client";

/**
 * STUB (f3/support): the outbox `emitEvent` is implemented by the events
 * work (3.1, f3/events). Same signature; writes nothing until that lands.
 * Callers pass the transaction that performs the business change so the
 * real implementation can write the DomainEvent row atomically with it.
 */
export async function emitEvent(
  _tx: Prisma.TransactionClient,
  _type: string,
  _payload: Record<string, unknown>
): Promise<void> {
  // no-op
}
