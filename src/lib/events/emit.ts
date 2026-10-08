import type { Prisma } from "@prisma/client";

/**
 * STUB (f3/cards): the events agent (f3/events) provides the real outbox
 * implementation with this exact signature — `emitEvent(tx, type, payload)`
 * writes a DomainEvent row in the caller's transaction. Until that branch is
 * merged this is a no-op so callers can already emit at the right place.
 */
export async function emitEvent(
  _tx: Prisma.TransactionClient,
  _type: string,
  _payload: Record<string, unknown>
): Promise<void> {
  // Intentionally empty; replaced by src/lib/events (Faz 3.1).
}
