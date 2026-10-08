import {
  buildLoginToken,
  createLoginNonce,
  hashLoginNonce,
  verifyLoginToken,
} from "@/lib/auth/two-factor";
import { db } from "@/lib/db";

/**
 * Issues the single-use token the credentials provider accepts instead of a
 * password. Only call after the user has fully proven their identity
 * (password + second factor, or a password change inside a live session).
 * Issuing a new token invalidates any previous unused one.
 */
export async function issueLoginToken(user: { id: string; email: string }) {
  const nonce = createLoginNonce();

  await db.user.update({
    where: { id: user.id },
    data: { loginTokenNonceHash: hashLoginNonce(nonce) },
  });

  return buildLoginToken(user.id, user.email, nonce);
}

/** Verifies and atomically burns a login token. */
export async function consumeLoginToken(
  token: string,
  user: { id: string; email: string }
) {
  const payload = verifyLoginToken(token);
  if (!payload || payload.userId !== user.id || payload.email !== user.email) {
    return false;
  }

  const { count } = await db.user.updateMany({
    where: { id: user.id, loginTokenNonceHash: hashLoginNonce(payload.nonce) },
    data: { loginTokenNonceHash: null },
  });

  return count === 1;
}

/**
 * Records a TOTP time step as used. Returns false when the same (or an older)
 * step was already accepted, i.e. the code is being replayed.
 */
export async function consumeTotpStep(userId: string, step: number) {
  const { count } = await db.user.updateMany({
    where: {
      id: userId,
      OR: [{ twoFactorLastUsedStep: null }, { twoFactorLastUsedStep: { lt: step } }],
    },
    data: { twoFactorLastUsedStep: step },
  });

  return count === 1;
}
