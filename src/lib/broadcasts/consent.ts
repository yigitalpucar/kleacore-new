import { createHmac } from "node:crypto";
import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events/emit";
import { getCurrentLegalDocument, hashLegalSnapshot } from "@/lib/legal/documents";
import { renderStaticLegalTemplate } from "@/lib/legal/render";
import { timingSafeStringEqual } from "@/lib/secrets/compare";
import { getAppBaseUrl } from "@/lib/stripe";

/**
 * Marketing consent (ticari elektronik ileti onayı) and the signed one-click
 * unsubscribe link of marketing broadcasts.
 *
 * Opting in stores a ConsentRecord (MARKETING_CONSENT, exact text shown);
 * opting out stamps `revokedAt` on the open record(s). Service / maintenance
 * announcements ignore this flag (transactional).
 */

export type ConsentSource = "panel" | "unsubscribe_link" | "one_click" | "admin";

const TOKEN_PURPOSE = "broadcast-unsubscribe:v1:";

function signingSecret() {
  const secret = process.env.AUTH_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) throw new Error("AUTH_SECRET is required for unsubscribe links");
  return secret;
}

function signature(userId: string) {
  return createHmac("sha256", signingSecret()).update(`${TOKEN_PURPOSE}${userId}`).digest("base64url");
}

/**
 * `<base64url(userId)>.<HMAC>`. No expiry: an unsubscribe link must keep
 * working in an old mail. It only ever turns marketing mail off, so a leaked
 * link cannot do more than that.
 */
export function createUnsubscribeToken(userId: string) {
  return `${Buffer.from(userId, "utf8").toString("base64url")}.${signature(userId)}`;
}

/** The user id of a valid token, else null. */
export function verifyUnsubscribeToken(token: string | null | undefined): string | null {
  if (typeof token !== "string" || token.length > 512) return null;
  const [encoded, sig, extra] = token.trim().split(".");
  if (!encoded || !sig || extra !== undefined) return null;
  let userId: string;
  try {
    userId = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return null;
  }
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(userId)) return null;
  return timingSafeStringEqual(sig, signature(userId)) ? userId : null;
}

export const UNSUBSCRIBE_PATH = "/abonelik/iptal";

export function unsubscribeUrl(userId: string, baseUrl = getAppBaseUrl()) {
  return `${baseUrl}${UNSUBSCRIBE_PATH}?t=${encodeURIComponent(createUnsubscribeToken(userId))}`;
}

/** One-click POST target of the List-Unsubscribe header. */
export function oneClickUnsubscribeUrl(userId: string, baseUrl = getAppBaseUrl()) {
  return `${baseUrl}/api/abonelik/iptal?t=${encodeURIComponent(createUnsubscribeToken(userId))}`;
}

export interface ConsentMeta {
  source: ConsentSource;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Turns marketing consent on or off. Idempotent: setting the current value
 * changes nothing (no duplicate records, no event). Applied immediately —
 * the dispatcher re-checks consent before every marketing message.
 */
export async function setMarketingConsent(userId: string, granted: boolean, meta: ConsentMeta) {
  const document = granted ? await getCurrentLegalDocument("MARKETING_CONSENT") : null;

  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, marketingConsent: true } });
    if (!user) return { changed: false as const, found: false as const };
    if (user.marketingConsent === granted) return { changed: false as const, found: true as const };

    const now = new Date();
    // Guarded update: two concurrent clicks change it once.
    const { count } = await tx.user.updateMany({
      where: { id: userId, marketingConsent: !granted },
      data: { marketingConsent: granted, marketingConsentAt: now },
    });
    if (count === 0) return { changed: false as const, found: true as const };

    if (granted && document) {
      const snapshot = renderStaticLegalTemplate(document.content);
      await tx.consentRecord.create({
        data: {
          userId,
          documentId: document.id,
          documentType: document.type,
          documentVersion: document.version,
          snapshot,
          snapshotHash: hashLegalSnapshot(snapshot),
          ipAddress: meta.ipAddress ?? null,
          userAgent: meta.userAgent ?? null,
          acceptedAt: now,
        },
      });
    } else {
      await tx.consentRecord.updateMany({
        where: { userId, documentType: "MARKETING_CONSENT", revokedAt: null },
        data: { revokedAt: now },
      });
    }

    await emitEvent(tx, "user.marketing_consent_changed", { userId, granted, source: meta.source });
    return { changed: true as const, found: true as const };
  });
}
