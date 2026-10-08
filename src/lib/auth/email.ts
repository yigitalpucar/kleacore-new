import { db } from "@/lib/db";

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

/**
 * Looks a user up by e-mail case-insensitively, so accounts created before
 * e-mails were normalised (mixed case) keep working.
 */
export function findUserByEmail(email: string) {
  return db.user.findFirst({
    where: { email: { equals: normalizeEmail(email), mode: "insensitive" } },
  });
}
