"use server";

import { hash } from "bcryptjs";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireCustomer } from "@/lib/utils/auth-helpers";
import type { EmailAccountStatus } from "@prisma/client";

interface CreateEmailAccountInput {
  localPart: string;
  domain: string;
  quotaMb?: number;
}

const LOCAL_PART_PATTERN = /^[a-z0-9._-]+$/i;
const DOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;
const ALLOWED_QUOTAS = new Set([512, 1024, 2048, 5120, 10240]);

function normalizeLocalPart(value: string) {
  return value.trim().toLowerCase();
}

function normalizeDomain(value: string) {
  return value.trim().toLowerCase();
}

function normalizeQuota(value?: number) {
  if (!value || Number.isNaN(value)) return 2048;
  if (ALLOWED_QUOTAS.has(value)) return value;
  return 2048;
}

export async function markEmailAsRead(emailId: string) {
  const session = await requireCustomer();

  try {
    const email = await db.emailMessage.findUnique({
      where: { id: emailId },
      select: { id: true, customerId: true, isRead: true },
    });

    if (!email || email.customerId !== session.user.id) {
      return { success: false, error: "E-posta bulunamadı" };
    }

    if (email.isRead) {
      return { success: true };
    }

    await db.emailMessage.update({
      where: { id: email.id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    revalidatePath("/musteri/panel/e-posta");
    return { success: true };
  } catch {
    return { success: false, error: "E-posta güncellenemedi" };
  }
}

export async function createEmailAccount(input: CreateEmailAccountInput) {
  const session = await requireCustomer();

  try {
    const localPart = normalizeLocalPart(input.localPart);
    const domain = normalizeDomain(input.domain);
    const quotaMb = normalizeQuota(input.quotaMb);

    if (!localPart || localPart.length < 2 || localPart.length > 64) {
      return { success: false, error: "Geçerli bir kullanıcı adı girin" };
    }

    if (!LOCAL_PART_PATTERN.test(localPart)) {
      return {
        success: false,
        error: "Kullanıcı adı sadece harf, sayı, nokta, tire ve alt çizgi içerebilir",
      };
    }

    if (!domain || !DOMAIN_PATTERN.test(domain)) {
      return { success: false, error: "Geçerli bir domain seçin" };
    }

    const customerDomain = await db.domain.findFirst({
      where: {
        customerId: session.user.id,
        name: {
          equals: domain,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        name: true,
        status: true,
      },
    });

    if (!customerDomain) {
      return { success: false, error: "Bu domain hesabınıza ait değil" };
    }

    if (customerDomain.status !== "ACTIVE") {
      return {
        success: false,
        error: "Sadece aktif domainler için e-posta hesabı oluşturabilirsiniz",
      };
    }

    const email = `${localPart}@${customerDomain.name.toLowerCase()}`;

    const existing = await db.emailAccount.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existing) {
      return { success: false, error: "Bu e-posta adresi zaten kullanılıyor" };
    }

    const generatedSecret = randomBytes(12).toString("hex");
    const passwordHash = await hash(generatedSecret, 10);

    const account = await db.emailAccount.create({
      data: {
        customerId: session.user.id,
        domainId: customerDomain.id,
        localPart,
        email,
        passwordHash,
        quotaMb,
        usedMb: 0,
        status: "ACTIVE",
      },
    });

    await db.emailMessage.create({
      data: {
        customerId: session.user.id,
        subject: "Yeni e-posta hesabı oluşturuldu",
        preview: `${email} hesabınız başarıyla oluşturuldu.`,
        content: `${email} hesabınız ${quotaMb} MB kota ile oluşturuldu.`,
        category: "SERVICE",
      },
    });

    revalidatePath("/musteri/panel/webmail");
    revalidatePath("/musteri/panel/e-posta");

    return {
      success: true,
      data: {
        id: account.id,
        email: account.email,
        domain: customerDomain.name,
        quota: account.quotaMb,
        used: account.usedMb,
        status: "active",
        forwardTo: account.forwardTo,
        autoResponder: account.autoResponder,
        createdAt: account.createdAt.toISOString(),
        lastLogin: account.lastLoginAt ? account.lastLoginAt.toISOString() : null,
      },
    };
  } catch {
    return { success: false, error: "E-posta hesabı oluşturulamadı" };
  }
}

export async function updateEmailAccountStatus(
  accountId: string,
  status: EmailAccountStatus
) {
  const session = await requireCustomer();

  try {
    if (!["ACTIVE", "SUSPENDED"].includes(status)) {
      return { success: false, error: "Geçersiz durum değeri" };
    }

    const account = await db.emailAccount.findUnique({
      where: { id: accountId },
      select: { id: true, customerId: true, email: true, status: true },
    });

    if (!account || account.customerId !== session.user.id) {
      return { success: false, error: "E-posta hesabı bulunamadı" };
    }

    if (account.status === status) {
      return { success: true };
    }

    await db.emailAccount.update({
      where: { id: account.id },
      data: { status },
    });

    await db.emailMessage.create({
      data: {
        customerId: session.user.id,
        subject:
          status === "ACTIVE"
            ? "E-posta hesabı aktifleştirildi"
            : "E-posta hesabı askıya alındı",
        preview:
          status === "ACTIVE"
            ? `${account.email} hesabınız yeniden aktifleştirildi.`
            : `${account.email} hesabınız askıya alındı.`,
        content:
          status === "ACTIVE"
            ? `${account.email} hesabınız tekrar kullanılabilir durumdadır.`
            : `${account.email} hesabınız geçici olarak askıya alındı.`,
        category: "SECURITY",
      },
    });

    revalidatePath("/musteri/panel/webmail");
    revalidatePath("/musteri/panel/e-posta");
    return { success: true };
  } catch {
    return { success: false, error: "Hesap durumu güncellenemedi" };
  }
}

export async function deleteEmailAccount(accountId: string) {
  const session = await requireCustomer();

  try {
    const account = await db.emailAccount.findUnique({
      where: { id: accountId },
      select: { id: true, customerId: true, email: true },
    });

    if (!account || account.customerId !== session.user.id) {
      return { success: false, error: "E-posta hesabı bulunamadı" };
    }

    await db.emailAccount.delete({
      where: { id: account.id },
    });

    await db.emailMessage.create({
      data: {
        customerId: session.user.id,
        subject: "E-posta hesabı silindi",
        preview: `${account.email} hesabınız silindi.`,
        content: `${account.email} hesabınız sistemden kaldırıldı.`,
        category: "SECURITY",
      },
    });

    revalidatePath("/musteri/panel/webmail");
    revalidatePath("/musteri/panel/e-posta");
    return { success: true };
  } catch {
    return { success: false, error: "E-posta hesabı silinemedi" };
  }
}
