/**
 * Admin API authentication: `Authorization: Bearer kc_admin_…`.
 *
 * On every request: the token must exist (prefix lookup + constant-time hash
 * compare), not be revoked or expired, its owner must still be an ACTIVE
 * staff member (with 2FA when the owner requires it for staff), and the
 * client IP must match the token's allowlist. The effective scopes are the
 * token's scopes ∩ the owner's current role permissions.
 */
import { hasPermission, isStaffRole, type Permission, type StaffRole } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { verifyApiKeyHash } from "@/lib/secrets/api-keys";
import { staffTwoFactorMissing } from "@/lib/utils/auth-helpers";
import { ApiError } from "./errors";
import { isIpAllowed } from "./ip";
import { effectiveScopes } from "./scopes";
import { ADMIN_TOKEN_PREFIX, adminTokenPrefix } from "./tokens";

/** lastUsedAt/lastUsedIp are written at most this often per token (same IP). */
const TOUCH_INTERVAL_MS = 60_000;

export interface AdminApiContext {
  token: { id: string; name: string; rateLimitPerMinute: number };
  owner: { id: string; role: StaffRole; name: string; email: string };
  /** Effective scopes (token scopes the owner still holds). */
  scopes: Permission[];
  ip: string | null;
}

export type AdminApiAuthResult =
  | { ok: true; context: AdminApiContext }
  | { ok: false; error: ApiError; token?: { id: string; name: string; ownerId: string } };

export function extractBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization")?.trim();
  if (!authorization?.toLowerCase().startsWith("bearer ")) return null;
  return authorization.slice(7).trim() || null;
}

const fail = (status: number, code: string, message: string, token?: { id: string; name: string; ownerId: string }) =>
  ({ ok: false as const, error: new ApiError(status, code, message), token });

export async function authenticateAdminApiRequest(request: Request, ip: string | null): Promise<AdminApiAuthResult> {
  const secret = extractBearerToken(request);
  if (!secret) return fail(401, "unauthenticated", "Authorization: Bearer <token> başlığı gerekli");
  if (!secret.startsWith(ADMIN_TOKEN_PREFIX)) return fail(401, "invalid_token", "Token geçersiz");

  const candidates = await db.staffApiToken.findMany({
    where: { tokenPrefix: adminTokenPrefix(secret) },
    select: {
      id: true,
      name: true,
      tokenHash: true,
      scopes: true,
      ipAllowlist: true,
      rateLimitPerMinute: true,
      expiresAt: true,
      revokedAt: true,
      lastUsedAt: true,
      lastUsedIp: true,
      user: { select: { id: true, role: true, status: true, name: true, surname: true, email: true } },
    },
  });
  const token = candidates.find((candidate) => verifyApiKeyHash(secret, candidate.tokenHash));
  if (!token) return fail(401, "invalid_token", "Token geçersiz");

  const ref = { id: token.id, name: token.name, ownerId: token.user.id };
  const now = new Date();
  if (token.revokedAt) return fail(401, "token_revoked", "Token iptal edilmiş", ref);
  if (token.expiresAt && token.expiresAt <= now) return fail(401, "token_expired", "Token süresi dolmuş", ref);

  const owner = token.user;
  if (owner.status !== "ACTIVE" || !isStaffRole(owner.role)) {
    return fail(401, "owner_inactive", "Token sahibinin personel hesabı aktif değil", ref);
  }
  if (!hasPermission(owner.role, "api_tokens.manage")) {
    return fail(403, "owner_not_allowed", "Token sahibinin rolü Admin API kullanımına izin vermiyor", ref);
  }
  if (await staffTwoFactorMissing(owner.id)) {
    return fail(403, "owner_two_factor_required", "Token sahibinin iki adımlı doğrulamayı açması gerekiyor", ref);
  }
  if (!isIpAllowed(ip, token.ipAllowlist)) {
    return fail(403, "ip_not_allowed", `Bu IP adresinden (${ip ?? "bilinmiyor"}) erişime izin verilmiyor`, ref);
  }

  if (!token.lastUsedAt || now.getTime() - token.lastUsedAt.getTime() > TOUCH_INTERVAL_MS || token.lastUsedIp !== ip) {
    await db.staffApiToken.update({ where: { id: token.id }, data: { lastUsedAt: now, lastUsedIp: ip } });
  }

  return {
    ok: true,
    context: {
      token: { id: token.id, name: token.name, rateLimitPerMinute: token.rateLimitPerMinute },
      owner: {
        id: owner.id,
        role: owner.role,
        name: `${owner.name} ${owner.surname}`.trim() || owner.email,
        email: owner.email,
      },
      scopes: effectiveScopes(token.scopes, owner.role),
      ip,
    },
  };
}
