import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = {
    $executeRaw: vi.fn(),
    user: { findUnique: vi.fn(), count: vi.fn(), update: vi.fn() },
  };
  return {
    tx,
    db: {
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
      user: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
      passwordResetToken: { create: vi.fn() },
    },
    findUserByEmail: vi.fn(),
    sendNotification: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/auth/email", () => ({
  findUserByEmail: mocks.findUserByEmail,
  normalizeEmail: (e: string) => e.trim().toLowerCase(),
}));
vi.mock("@/lib/notifications/send", () => ({ sendNotification: mocks.sendNotification }));

import { StaffError, changeStaffRole, inviteStaff, sendStaffInvite, setStaffActive } from "./staff";

const admin = { id: "a1", role: "ADMIN", status: "ACTIVE" };

describe("last-admin protection", () => {
  beforeEach(() => {
    mocks.tx.user.update.mockImplementation(async ({ data }) => ({ ...admin, ...data }));
  });

  it("refuses to demote the only active ADMIN", async () => {
    mocks.tx.user.findUnique.mockResolvedValue(admin);
    mocks.tx.user.count.mockResolvedValue(0);
    await expect(changeStaffRole("a1", "SUPPORT")).rejects.toThrow(StaffError);
    await expect(changeStaffRole("a1", "SUPPORT")).rejects.toThrow(/Son aktif yönetici/);
    expect(mocks.tx.user.update).not.toHaveBeenCalled();
    // Serialised with an advisory lock against concurrent demotions.
    expect(mocks.tx.$executeRaw).toHaveBeenCalled();
    expect(mocks.tx.user.count).toHaveBeenCalledWith({
      where: { role: "ADMIN", status: "ACTIVE", id: { not: "a1" } },
    });
  });

  it("allows demoting an ADMIN when another active ADMIN exists", async () => {
    mocks.tx.user.findUnique.mockResolvedValue(admin);
    mocks.tx.user.count.mockResolvedValue(1);
    const result = await changeStaffRole("a1", "BILLING");
    expect(result).toMatchObject({ before: "ADMIN", after: "BILLING" });
    expect(mocks.tx.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { role: "BILLING" } }));
  });

  it("refuses to deactivate the only active ADMIN", async () => {
    mocks.tx.user.findUnique.mockResolvedValue(admin);
    mocks.tx.user.count.mockResolvedValue(0);
    await expect(setStaffActive("a1", false, "someone-else")).rejects.toThrow(/Son aktif yönetici/);
    expect(mocks.tx.user.update).not.toHaveBeenCalled();
  });

  it("refuses to deactivate yourself", async () => {
    await expect(setStaffActive("a1", false, "a1")).rejects.toThrow(/Kendi hesabınızı/);
  });

  it("deactivating revokes sessions; non-admins need no admin count", async () => {
    mocks.tx.user.findUnique.mockResolvedValue({ id: "s1", role: "SUPPORT", status: "ACTIVE" });
    await setStaffActive("s1", false, "a1");
    expect(mocks.tx.user.count).not.toHaveBeenCalled();
    expect(mocks.tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "SUSPENDED", sessionVersion: { increment: 1 } } })
    );
  });

  it("promoting to ADMIN or reactivating needs no admin count", async () => {
    mocks.tx.user.findUnique.mockResolvedValue({ id: "s1", role: "SUPPORT", status: "SUSPENDED" });
    await setStaffActive("s1", true, "a1");
    await changeStaffRole("s1", "ADMIN");
    expect(mocks.tx.user.count).not.toHaveBeenCalled();
  });

  it("only manages staff accounts and staff roles", async () => {
    mocks.tx.user.findUnique.mockResolvedValue({ id: "c1", role: "CUSTOMER", status: "ACTIVE" });
    await expect(changeStaffRole("c1", "ADMIN")).rejects.toThrow(/Personel bulunamadı/);
    await expect(changeStaffRole("a1", "CUSTOMER")).rejects.toThrow(/Geçersiz rol/);
  });
});

describe("inviteStaff", () => {
  it("creates a verified staff user with an unusable password", async () => {
    mocks.findUserByEmail.mockResolvedValue(null);
    mocks.db.user.create.mockImplementation(async ({ data }) => ({ id: "n1", ...data }));
    await inviteStaff({ email: " Destek@Example.com ", name: "Ali", role: "SUPPORT" });
    const data = mocks.db.user.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ email: "destek@example.com", name: "Ali", role: "SUPPORT", status: "ACTIVE" });
    expect(data.emailVerifiedAt).toBeInstanceOf(Date);
    expect(data.password).toMatch(/^\$2[aby]\$/);
  });

  it("rejects existing emails, bad roles and missing names", async () => {
    mocks.findUserByEmail.mockResolvedValue({ id: "x" });
    await expect(inviteStaff({ email: "a@b.co", name: "A", role: "SUPPORT" })).rejects.toThrow(/zaten var/);
    mocks.findUserByEmail.mockResolvedValue(null);
    await expect(inviteStaff({ email: "a@b.co", name: "A", role: "CUSTOMER" })).rejects.toThrow(/Geçersiz rol/);
    await expect(inviteStaff({ email: "a@b.co", name: " ", role: "BILLING" })).rejects.toThrow(/Ad zorunlu/);
    expect(mocks.db.user.create).not.toHaveBeenCalled();
  });

  it("sends the staff invite with a one-time token", async () => {
    mocks.db.user.findUnique.mockResolvedValue({ role: "BILLING" });
    await sendStaffInvite("n1", { invitedBy: "Yiğit" });
    expect(mocks.db.passwordResetToken.create).toHaveBeenCalled();
    expect(mocks.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "n1",
        template: "account.staff-invite",
        channel: "EMAIL",
        data: expect.objectContaining({ roleLabel: "Muhasebe", invitedBy: "Yiğit", expiresInDays: 7 }),
      })
    );
  });
});
