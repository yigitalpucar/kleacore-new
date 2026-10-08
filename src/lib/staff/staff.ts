/**
 * Staff management (3.6): invite, role change, deactivate/reactivate.
 *
 * Invariant: at least one ACTIVE ADMIN always exists. Every change that could
 * remove the last one runs in a transaction holding an advisory lock, so two
 * admins demoting each other at the same time cannot both succeed.
 */
import { createHash, randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { hash } from "bcryptjs";
import { findUserByEmail, normalizeEmail } from "@/lib/auth/email";
import { ROLE_LABELS, STAFF_ROLES, isStaffRole, type StaffRole } from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { sendNotification } from "@/lib/notifications/send";

export const STAFF_INVITE_TTL_DAYS = 7;

export class StaffError extends Error {}

const staffSelect = {
  id: true,
  email: true,
  name: true,
  surname: true,
  role: true,
  status: true,
  twoFactorEnabled: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export async function listStaff() {
  return db.user.findMany({
    where: { role: { in: [...STAFF_ROLES] } },
    select: staffSelect,
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
}

async function lockAdmins(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('kleacore.staff.admins'))`;
}

/** Throws when `userId` is the only ACTIVE ADMIN (call inside the locked tx). */
async function assertNotLastActiveAdmin(tx: Prisma.TransactionClient, userId: string) {
  const others = await tx.user.count({
    where: { role: "ADMIN", status: "ACTIVE", id: { not: userId } },
  });
  if (others === 0) {
    throw new StaffError("Son aktif yönetici bu işlemle kaldırılamaz. Önce başka bir yönetici atayın.");
  }
}

async function loadStaff(tx: Prisma.TransactionClient, userId: string) {
  const user = await tx.user.findUnique({ where: { id: userId }, select: staffSelect });
  if (!user || !isStaffRole(user.role)) throw new StaffError("Personel bulunamadı.");
  return user as typeof user & { role: StaffRole };
}

export interface InviteStaffInput {
  email: string;
  name: string;
  surname?: string;
  role: string;
}

export async function inviteStaff(input: InviteStaffInput) {
  const email = normalizeEmail(input.email ?? "");
  const name = (input.name ?? "").trim();
  const surname = (input.surname ?? "").trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new StaffError("Geçerli bir e-posta adresi girin.");
  if (!name) throw new StaffError("Ad zorunludur.");
  if (!isStaffRole(input.role)) throw new StaffError("Geçersiz rol.");

  if (await findUserByEmail(email)) {
    throw new StaffError("Bu e-posta adresiyle kayıtlı bir hesap zaten var.");
  }

  // No usable password until the invite link sets one.
  const password = await hash(randomBytes(32).toString("hex"), 10);
  return db.user.create({
    data: {
      email,
      name,
      surname,
      password,
      role: input.role,
      status: "ACTIVE",
      // Invited by an admin: the address is vouched for.
      emailVerifiedAt: new Date(),
    },
    select: staffSelect,
  });
}

function appBaseUrl() {
  return (process.env.APP_URL || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "");
}

/**
 * One-time "set your password" link (PasswordResetToken, 7-day TTL — the
 * same mechanism as the import invite) sent with `account.staff-invite`.
 */
export async function sendStaffInvite(userId: string, options: { invitedBy?: string } = {}) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user || !isStaffRole(user.role)) throw new StaffError("Personel bulunamadı.");

  const rawToken = randomBytes(32).toString("hex");
  await db.passwordResetToken.create({
    data: {
      userId,
      tokenHash: createHash("sha256").update(rawToken).digest("hex"),
      expiresAt: new Date(Date.now() + STAFF_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
  });
  return sendNotification({
    userId,
    template: "account.staff-invite",
    data: {
      inviteUrl: `${appBaseUrl()}/musteri/sifre-sifirla?token=${encodeURIComponent(rawToken)}`,
      expiresInDays: STAFF_INVITE_TTL_DAYS,
      roleLabel: ROLE_LABELS[user.role],
      invitedBy: options.invitedBy,
    },
    channel: "EMAIL",
  });
}

export async function changeStaffRole(userId: string, role: string) {
  if (!isStaffRole(role)) throw new StaffError("Geçersiz rol.");
  return db.$transaction(async (tx) => {
    await lockAdmins(tx);
    const user = await loadStaff(tx, userId);
    if (user.role === role) return { before: user.role, after: role, user };
    if (user.role === "ADMIN" && user.status === "ACTIVE") {
      await assertNotLastActiveAdmin(tx, userId);
    }
    const updated = await tx.user.update({ where: { id: userId }, data: { role }, select: staffSelect });
    return { before: user.role, after: role, user: updated };
  });
}

/**
 * Deactivate (SUSPENDED) or reactivate (ACTIVE) a staff account. A
 * deactivated user's session ends at the next session re-check (≤5 min).
 */
export async function setStaffActive(userId: string, active: boolean, actorId: string) {
  if (!active && userId === actorId) throw new StaffError("Kendi hesabınızı devre dışı bırakamazsınız.");
  return db.$transaction(async (tx) => {
    await lockAdmins(tx);
    const user = await loadStaff(tx, userId);
    const status = active ? "ACTIVE" : "SUSPENDED";
    if (user.status === status) return user;
    if (!active && user.role === "ADMIN" && user.status === "ACTIVE") {
      await assertNotLastActiveAdmin(tx, userId);
    }
    return tx.user.update({
      where: { id: userId },
      // Bumping sessionVersion also revokes any session at the next re-check.
      data: { status, ...(active ? {} : { sessionVersion: { increment: 1 } }) },
      select: staffSelect,
    });
  });
}
