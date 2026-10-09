/**
 * Admin API tokens (StaffApiToken): create, list, revoke.
 *
 * - The secret (`kc_admin_` + 48 hex) is returned once; the row keeps its
 *   prefix (lookup/display) and SHA-256 (src/lib/secrets/api-keys.ts).
 * - Scopes must be a subset of the creator's own permissions at creation;
 *   at request time they are intersected again with the owner's current
 *   permissions (src/lib/admin-api/auth.ts).
 * - The owner revokes their own tokens; staff.manage revokes anyone's.
 */
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { logActivity } from "@/lib/activity-log";
import { hasPermission, isStaffRole, permissionsForRole } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { hashApiKey } from "@/lib/secrets/api-keys";
import { parseAllowlist } from "./ip";
import { isPermission } from "./scopes";

export const ADMIN_TOKEN_PREFIX = "kc_admin_";
/** "kc_admin_" + 8 hex: enough to narrow the lookup, useless on its own. */
export const ADMIN_TOKEN_PREFIX_LENGTH = ADMIN_TOKEN_PREFIX.length + 8;
export const DEFAULT_RATE_LIMIT_PER_MINUTE = 120;
export const MAX_TOKENS_PER_USER = 20;

export class TokenError extends Error {}

export function generateAdminTokenSecret() {
  return `${ADMIN_TOKEN_PREFIX}${randomBytes(24).toString("hex")}`;
}

export function adminTokenPrefix(secret: string) {
  return secret.slice(0, ADMIN_TOKEN_PREFIX_LENGTH);
}

export const createTokenSchema = z.object({
  name: z.string().trim().min(1, "Ad zorunludur").max(80, "Ad en fazla 80 karakter olabilir"),
  scopes: z.array(z.string()).min(1, "En az bir yetki seçin"),
  /** Textarea / comma list or array of IPs and CIDR ranges. */
  ipAllowlist: z.union([z.string(), z.array(z.string())]).optional(),
  /** null / undefined = never expires. */
  expiresInDays: z.coerce.number().int().min(1).max(730).nullish(),
  rateLimitPerMinute: z.coerce.number().int().min(1).max(1000).default(DEFAULT_RATE_LIMIT_PER_MINUTE),
});

export type CreateTokenInput = z.input<typeof createTokenSchema>;

export interface TokenOwner {
  id: string;
  role: unknown;
}

export const tokenSelect = {
  id: true,
  userId: true,
  name: true,
  tokenPrefix: true,
  scopes: true,
  ipAllowlist: true,
  rateLimitPerMinute: true,
  expiresAt: true,
  lastUsedAt: true,
  lastUsedIp: true,
  revokedAt: true,
  createdAt: true,
  user: { select: { id: true, name: true, surname: true, email: true, role: true, status: true } },
} as const;

export async function createStaffApiToken(owner: TokenOwner, input: CreateTokenInput) {
  if (!isStaffRole(owner.role)) throw new TokenError("Yalnızca personel API tokenı oluşturabilir.");
  const parsed = createTokenSchema.safeParse(input);
  if (!parsed.success) throw new TokenError(parsed.error.issues[0]?.message ?? "Geçersiz token bilgisi");
  const data = parsed.data;

  const granted = permissionsForRole(owner.role);
  const scopes = [...new Set(data.scopes)];
  const unknown = scopes.filter((scope) => !isPermission(scope));
  if (unknown.length > 0) throw new TokenError(`Bilinmeyen yetki: ${unknown.join(", ")}`);
  const exceeding = scopes.filter((scope) => !granted.includes(scope as never));
  if (exceeding.length > 0) {
    throw new TokenError(`Sahip olmadığınız yetkiler token'a verilemez: ${exceeding.join(", ")}`);
  }

  const allowlist = parseAllowlist(data.ipAllowlist ?? []);
  if (allowlist.invalid.length > 0) {
    throw new TokenError(`Geçersiz IP / CIDR: ${allowlist.invalid.join(", ")}`);
  }

  const active = await db.staffApiToken.count({ where: { userId: owner.id, revokedAt: null } });
  if (active >= MAX_TOKENS_PER_USER) {
    throw new TokenError(`En fazla ${MAX_TOKENS_PER_USER} aktif token olabilir; kullanılmayanları iptal edin.`);
  }

  const secret = generateAdminTokenSecret();
  const token = await db.staffApiToken.create({
    data: {
      userId: owner.id,
      name: data.name,
      tokenPrefix: adminTokenPrefix(secret),
      tokenHash: hashApiKey(secret),
      scopes,
      ipAllowlist: allowlist.entries,
      rateLimitPerMinute: data.rateLimitPerMinute,
      expiresAt: data.expiresInDays ? new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000) : null,
    },
    select: tokenSelect,
  });

  await logActivity({
    userId: owner.id,
    action: "STAFF_API_TOKEN_CREATE",
    entity: "StaffApiToken",
    entityId: token.id,
    details: {
      name: token.name,
      prefix: token.tokenPrefix,
      scopes,
      ipAllowlist: allowlist.entries,
      expiresAt: token.expiresAt?.toISOString() ?? null,
    },
  });

  return { token, secret };
}

export async function revokeStaffApiToken(actor: TokenOwner, tokenId: string) {
  const token = await db.staffApiToken.findUnique({
    where: { id: tokenId },
    select: { id: true, userId: true, name: true, tokenPrefix: true, revokedAt: true },
  });
  if (!token) throw new TokenError("Token bulunamadı.");
  const own = token.userId === actor.id;
  if (!own && !hasPermission(actor.role, "staff.manage")) throw new TokenError("Bu token'ı iptal etme yetkiniz yok.");
  if (token.revokedAt) return token;

  const revoked = await db.staffApiToken.update({
    where: { id: tokenId },
    data: { revokedAt: new Date(), revokedById: actor.id },
    select: { id: true, userId: true, name: true, tokenPrefix: true, revokedAt: true },
  });

  await logActivity({
    userId: actor.id,
    action: "STAFF_API_TOKEN_REVOKE",
    entity: "StaffApiToken",
    entityId: tokenId,
    details: { name: token.name, prefix: token.tokenPrefix, ownerId: token.userId, byOwner: own },
  });

  return revoked;
}

export function listStaffApiTokens(where: { userId?: string } = {}) {
  return db.staffApiToken.findMany({
    where,
    select: tokenSelect,
    orderBy: [{ revokedAt: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }],
    take: 500,
  });
}

export type StaffApiTokenRow = Awaited<ReturnType<typeof listStaffApiTokens>>[number];

/** Display state of a token row. */
export function tokenState(token: { revokedAt: Date | null; expiresAt: Date | null }, now = new Date()) {
  if (token.revokedAt) return "revoked" as const;
  if (token.expiresAt && token.expiresAt <= now) return "expired" as const;
  return "active" as const;
}
