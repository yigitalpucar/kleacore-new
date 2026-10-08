/**
 * Invitation for customers created by an import: no password is set at
 * creation (an unusable random hash); the link is a PasswordResetToken with a
 * longer TTL, so /musteri/sifre-sifirla sets the first password.
 */
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { sendNotification } from "@/lib/notifications/send";

export const INVITE_TTL_DAYS = 7;

function appBaseUrl() {
  return (process.env.APP_URL || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

export async function sendAccountInvite(userId: string, options: { summary?: string; runId?: string } = {}) {
  const rawToken = randomBytes(32).toString("hex");
  await db.passwordResetToken.create({
    data: {
      userId,
      tokenHash: createHash("sha256").update(rawToken).digest("hex"),
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
  });
  return sendNotification({
    userId,
    template: "account.invite",
    data: {
      inviteUrl: `${appBaseUrl()}/musteri/sifre-sifirla?token=${encodeURIComponent(rawToken)}`,
      expiresInDays: INVITE_TTL_DAYS,
      summary: options.summary,
    },
    channel: "EMAIL",
    dedupeKey: `account.invite:${userId}${options.runId ? `:${options.runId}` : ""}`,
  });
}
