import type { JWT } from "next-auth/jwt";
import { db } from "@/lib/db";

export const SESSION_RECHECK_INTERVAL_MS = 5 * 60 * 1000;

type SignInUser = {
  id?: string;
  role?: string;
  sessionVersion?: number;
};

/**
 * JWT callback body. On sign-in it stamps the token; afterwards it re-reads
 * role/status/sessionVersion from the DB at most every 5 minutes so that
 * suspended users, demoted admins and sessions from before a password change
 * lose access without waiting for the JWT to expire. Returning null makes
 * Auth.js clear the session cookie.
 */
export async function refreshSessionToken(
  token: JWT,
  user?: SignInUser | null,
  now = Date.now()
): Promise<JWT | null> {
  if (user) {
    token.id = user.id;
    token.role = user.role;
    token.sessionVersion = user.sessionVersion ?? 0;
    token.checkedAt = now;
    return token;
  }

  if (typeof token.id !== "string" || !token.id) {
    return token;
  }

  if (typeof token.checkedAt === "number" && now - token.checkedAt < SESSION_RECHECK_INTERVAL_MS) {
    return token;
  }

  let current: { role: string; status: string; sessionVersion: number } | null;
  try {
    current = await db.user.findUnique({
      where: { id: token.id },
      select: { role: true, status: true, sessionVersion: true },
    });
  } catch (error) {
    // A DB blip must not log everyone out; retry on the next request.
    console.error("[auth] session re-check failed:", error);
    return token;
  }

  const tokenVersion = typeof token.sessionVersion === "number" ? token.sessionVersion : 0;
  if (!current || current.status !== "ACTIVE" || current.sessionVersion !== tokenVersion) {
    return null;
  }

  token.role = current.role;
  token.sessionVersion = current.sessionVersion;
  token.checkedAt = now;
  return token;
}
