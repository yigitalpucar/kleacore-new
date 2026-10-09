import { db } from "@/lib/db";
import { emitEvent } from "@/lib/events/emit";
import { createLogger } from "@/lib/logger";
import { deviceFingerprint, networkLabel } from "@/lib/security/device";

const log = createLogger("security.login-events");

/** Failed attempts (bad password / bad 2FA code) within the window that trigger a notice. */
export const FAILED_LOGIN_BURST_THRESHOLD = 5;
export const FAILED_LOGIN_BURST_WINDOW_MS = 60 * 60 * 1000;
/** At most one burst notice per account per this interval. */
export const FAILED_LOGIN_NOTICE_INTERVAL_MS = 60 * 60 * 1000;

export type LoginMethod = "password" | "two_factor" | "trusted_device" | "reissue";

export type LoginFailureReason =
  | "bad_password"
  | "inactive"
  | "unknown_user"
  | "bad_2fa"
  | "2fa_required";

export interface LoginEventInput {
  userId: string | null;
  email: string;
  success: boolean;
  reason?: LoginFailureReason;
  method?: LoginMethod;
  twoFactorUsed?: boolean;
  ip: string | null;
  userAgent: string | null;
  country?: string | null;
  /** User.sessionVersion the new session carries (successful logins). */
  sessionVersion?: number | null;
  /**
   * False for a session re-issued inside an existing one (password change,
   * "diğer oturumları kapat"): never a "new device".
   */
  detectNewDevice?: boolean;
  now?: Date;
}

export interface RecordedLoginEvent {
  id: string;
  newDevice: boolean;
  burstNotified: boolean;
}

/**
 * Records a sign-in attempt and emits the security events it implies:
 * `security.new_device_login` for a successful login from a fingerprint the
 * account never signed in from before (but only once the account has a login
 * history, so existing customers are not all notified on rollout), and
 * `security.failed_login_burst` (at most once an hour) when failures pile up.
 *
 * Never throws: an audit/notice problem must not break a login.
 */
export async function recordLoginEvent(input: LoginEventInput): Promise<RecordedLoginEvent | null> {
  try {
    const now = input.now ?? new Date();
    const fp = deviceFingerprint({ userAgent: input.userAgent, ip: input.ip, country: input.country });

    let newDevice = false;
    if (input.success && input.userId && input.detectNewDevice !== false) {
      const [history, known] = await Promise.all([
        db.loginEvent.count({ where: { userId: input.userId, success: true } }),
        db.loginEvent.findFirst({
          where: { userId: input.userId, success: true, deviceHash: fp.deviceHash },
          select: { id: true },
        }),
      ]);
      newDevice = history > 0 && !known;
    }

    const data = {
      userId: input.userId,
      email: input.email.slice(0, 254),
      success: input.success,
      reason: input.success ? null : (input.reason ?? null),
      method: input.method ?? null,
      twoFactorUsed: input.twoFactorUsed ?? false,
      ipAddress: input.ip?.slice(0, 64) ?? null,
      userAgent: input.userAgent?.slice(0, 512) ?? null,
      uaFamily: fp.uaFamily,
      network: fp.network,
      deviceHash: fp.deviceHash,
      newDevice,
      sessionVersion: input.success ? (input.sessionVersion ?? null) : null,
      createdAt: now,
    };

    const userId = input.userId;
    const row =
      newDevice && userId
        ? await db.$transaction(async (tx) => {
            const created = await tx.loginEvent.create({ data, select: { id: true } });
            await emitEvent(
              tx,
              "security.new_device_login",
              {
                userId,
                loginEventId: created.id,
                device: fp.uaFamily,
                ipAddress: input.ip ?? undefined,
                network: networkLabel(fp.network) ?? undefined,
                occurredAt: now,
                twoFactorUsed: input.twoFactorUsed ?? false,
              },
              { actorId: userId }
            );
            return created;
          })
        : await db.loginEvent.create({ data, select: { id: true } });

    let burstNotified = false;
    if (!input.success && input.userId && input.reason !== "unknown_user") {
      burstNotified = await notifyFailedLoginBurst(input.userId, now, input.ip);
    }

    return { id: row.id, newDevice, burstNotified };
  } catch (error) {
    log.error("login event could not be recorded", { error, success: input.success });
    return null;
  }
}

/**
 * Emits `security.failed_login_burst` when the account collected
 * {@link FAILED_LOGIN_BURST_THRESHOLD} failures within the last hour, at most
 * once per {@link FAILED_LOGIN_NOTICE_INTERVAL_MS}. The slot is claimed with a
 * conditional update on User.failedLoginNoticeAt, so concurrent failures can
 * never send two notices.
 */
export async function notifyFailedLoginBurst(userId: string, now: Date, ip: string | null): Promise<boolean> {
  const since = new Date(now.getTime() - FAILED_LOGIN_BURST_WINDOW_MS);
  const failures = await db.loginEvent.count({
    where: { userId, success: false, createdAt: { gte: since } },
  });
  if (failures < FAILED_LOGIN_BURST_THRESHOLD) return false;

  const cutoff = new Date(now.getTime() - FAILED_LOGIN_NOTICE_INTERVAL_MS);
  return db.$transaction(async (tx) => {
    const claim = await tx.user.updateMany({
      where: { id: userId, OR: [{ failedLoginNoticeAt: null }, { failedLoginNoticeAt: { lte: cutoff } }] },
      data: { failedLoginNoticeAt: now },
    });
    if (claim.count !== 1) return false;
    await emitEvent(tx, "security.failed_login_burst", {
      userId,
      failedAttempts: failures,
      windowMinutes: Math.round(FAILED_LOGIN_BURST_WINDOW_MS / 60000),
      lastIpAddress: ip ?? undefined,
      lastAttemptAt: now,
    });
    return true;
  });
}

/** JWT sessions live 30 days (Auth.js default maxAge). */
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Sessions that may still be valid: successful logins issued under the
 * account's current sessionVersion within the JWT lifetime. (JWTs are not
 * stored; a bump of sessionVersion is what ends them all.)
 */
export async function listActiveSessions(user: { id: string; sessionVersion: number }, now = new Date()) {
  return db.loginEvent.findMany({
    where: {
      userId: user.id,
      success: true,
      sessionVersion: user.sessionVersion,
      createdAt: { gte: new Date(now.getTime() - SESSION_MAX_AGE_MS) },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, createdAt: true, uaFamily: true, ipAddress: true, network: true, method: true, deviceHash: true },
  });
}

export async function listRecentLogins(userId: string, take = 20) {
  return db.loginEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      createdAt: true,
      success: true,
      reason: true,
      method: true,
      twoFactorUsed: true,
      uaFamily: true,
      ipAddress: true,
      network: true,
      newDevice: true,
    },
  });
}
