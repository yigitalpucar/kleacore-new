"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import { createLogger } from "@/lib/logger";
import { logActivity } from "@/lib/activity-log";
import { validateTrIban } from "@/lib/payments/bank-transfer/iban";
import {
  BankTransferError,
  approveBankTransferNotice,
  rejectBankTransferNotice,
} from "@/lib/payments/bank-transfer/service";

const log = createLogger("admin.bank-transfer");

const INTEGRATIONS_PATH = "/yonetim/entegrasyonlar";
const NOTICES_PATH = "/yonetim/faturalar/havale-bildirimleri";
const CURRENCIES = new Set(["TRY", "USD", "EUR"]);

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function feedback(success: boolean, message: string): never {
  const params = new URLSearchParams({ tab: "payment", status: success ? "success" : "error", message });
  redirect(`${INTEGRATIONS_PATH}?${params.toString()}`);
}

export async function saveBankAccount(formData: FormData) {
  await requireAdmin();

  const id = text(formData, "id");
  const bankName = text(formData, "bankName");
  const accountName = text(formData, "accountName");
  const branch = text(formData, "branch");
  const currency = text(formData, "currency").toUpperCase() || "TRY";
  const sortOrder = Number.parseInt(text(formData, "sortOrder") || "0", 10);
  const iban = validateTrIban(text(formData, "iban"));

  if (!bankName || !accountName) feedback(false, "Banka adı ve hesap sahibi zorunlu.");
  if (!iban.ok) feedback(false, iban.error);
  if (!CURRENCIES.has(currency)) feedback(false, "Para birimi TRY, USD veya EUR olmalı.");

  const data = {
    bankName: bankName.slice(0, 80),
    accountName: accountName.slice(0, 120),
    branch: branch.slice(0, 80),
    currency,
    iban: iban.iban,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
  };

  try {
    if (id) {
      await db.bankAccount.update({ where: { id }, data });
    } else {
      await db.bankAccount.create({ data });
    }
  } catch (error) {
    log.error("save bank account failed", { error });
    feedback(false, "Banka hesabı kaydedilemedi (aynı IBAN zaten kayıtlı olabilir).");
  }

  revalidatePath(INTEGRATIONS_PATH);
  feedback(true, "Banka hesabı kaydedildi.");
}

export async function toggleBankAccount(formData: FormData) {
  await requireAdmin();
  const id = text(formData, "id");
  const account = id ? await db.bankAccount.findUnique({ where: { id } }) : null;
  if (!account) feedback(false, "Banka hesabı bulunamadı.");

  await db.bankAccount.update({ where: { id }, data: { isActive: !account.isActive } });
  revalidatePath(INTEGRATIONS_PATH);
  feedback(true, account.isActive ? "Banka hesabı müşterilerden gizlendi." : "Banka hesabı yayında.");
}

export async function deleteBankAccount(formData: FormData) {
  await requireAdmin();
  const id = text(formData, "id");
  if (!id) feedback(false, "Banka hesabı bulunamadı.");

  // Notices keep their own amount/sender data; the link is nulled (SetNull).
  await db.bankAccount.delete({ where: { id } }).catch(() => null);
  revalidatePath(INTEGRATIONS_PATH);
  feedback(true, "Banka hesabı silindi.");
}

export async function approveBankTransferNoticeAction(noticeId: string) {
  const session = await requireAdmin();
  try {
    const result = await approveBankTransferNotice(noticeId, session.user.id);
    await logActivity({
      userId: session.user.id,
      action: "BANK_TRANSFER_APPROVED",
      entity: "Invoice",
      entityId: result.invoiceId,
      details: { noticeId, invoiceNumber: result.invoiceNumber },
    });
    revalidatePath(NOTICES_PATH);
    revalidatePath("/yonetim/faturalar");
    revalidatePath(`/yonetim/faturalar/${result.invoiceId}`);
    revalidatePath(`/musteri/panel/faturalar/${result.invoiceId}`);
    return { success: true as const, message: `${result.invoiceNumber} ödendi olarak işaretlendi` };
  } catch (error) {
    if (error instanceof BankTransferError) return { success: false as const, error: error.message };
    log.error("approve notice failed", { error, noticeId });
    return { success: false as const, error: "Bildirim onaylanamadı" };
  }
}

export async function rejectBankTransferNoticeAction(noticeId: string, reason: string) {
  const session = await requireAdmin();
  try {
    const result = await rejectBankTransferNotice(noticeId, session.user.id, reason);
    await logActivity({
      userId: session.user.id,
      action: "BANK_TRANSFER_REJECTED",
      entity: "Invoice",
      entityId: result.invoiceId,
      details: { noticeId, invoiceNumber: result.invoiceNumber, reason },
    });
    revalidatePath(NOTICES_PATH);
    revalidatePath(`/yonetim/faturalar/${result.invoiceId}`);
    revalidatePath(`/musteri/panel/faturalar/${result.invoiceId}`);
    return { success: true as const, message: "Bildirim reddedildi, müşteri bilgilendirilecek" };
  } catch (error) {
    if (error instanceof BankTransferError) return { success: false as const, error: error.message };
    log.error("reject notice failed", { error, noticeId });
    return { success: false as const, error: "Bildirim reddedilemedi" };
  }
}
