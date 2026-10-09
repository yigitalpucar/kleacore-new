"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { getPurchaseBlock } from "@/lib/auth/email-verification";
import { createLogger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRequestMeta } from "@/lib/request-meta";
import { requireCustomer } from "@/lib/utils/auth-helpers";
import {
  SAVED_CARDS_PATH,
  SavedCardError,
  chargeInvoiceWithSavedCard,
  deleteSavedCard,
  setAutoPay,
  setDefaultSavedCard,
  startCardVerification,
} from "@/lib/payments/saved-cards";

const log = createLogger("customer.saved-cards");

type ActionResult<T = undefined> = { success: true; message?: string; data?: T } | { success: false; error: string };

function failure(error: unknown, fallback: string): { success: false; error: string } {
  if (error instanceof SavedCardError) return { success: false, error: error.message };
  log.error(fallback, { error });
  return { success: false, error: fallback };
}

/** Consent checkbox → PENDING card + verification session; the page then opens the card form. */
export async function startAddSavedCard(input: { consent: boolean }): Promise<ActionResult<{ ref: string }>> {
  const session = await requireCustomer();
  const block = await getPurchaseBlock(session.user.id);
  if (block) return { success: false, error: block.error };
  try {
    const meta = await getRequestMeta();
    const { ref } = await startCardVerification({
      userId: session.user.id,
      consent: input?.consent === true,
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return { success: true, data: { ref } };
  } catch (error) {
    return failure(error, "Kart ekleme başlatılamadı");
  }
}

export async function makeSavedCardDefault(input: { cardId: string }): Promise<ActionResult> {
  const session = await requireCustomer();
  try {
    await setDefaultSavedCard(session.user.id, String(input?.cardId ?? ""));
    revalidatePath(SAVED_CARDS_PATH);
    return { success: true, message: "Varsayılan kart güncellendi" };
  } catch (error) {
    return failure(error, "Varsayılan kart güncellenemedi");
  }
}

export async function removeSavedCard(input: { cardId: string }): Promise<ActionResult> {
  const session = await requireCustomer();
  try {
    await deleteSavedCard(session.user.id, String(input?.cardId ?? ""));
    revalidatePath(SAVED_CARDS_PATH);
    return { success: true, message: "Kart silindi" };
  } catch (error) {
    return failure(error, "Kart silinemedi");
  }
}

export async function updateAutoPay(input: { enabled: boolean; consent?: boolean }): Promise<ActionResult> {
  const session = await requireCustomer();
  try {
    const meta = await getRequestMeta();
    await setAutoPay({
      userId: session.user.id,
      enabled: input?.enabled === true,
      consent: input?.consent === true,
      ip: meta.ip,
    });
    revalidatePath(SAVED_CARDS_PATH);
    return {
      success: true,
      message: input?.enabled ? "Otomatik ödeme açıldı" : "Otomatik ödeme kapatıldı",
    };
  } catch (error) {
    return failure(error, "Otomatik ödeme ayarı kaydedilemedi");
  }
}

/** "Kayıtlı kartla öde" on an invoice: charges the outstanding amount now. */
export async function payInvoiceWithSavedCard(input: { invoiceId: string; cardId: string }): Promise<ActionResult> {
  const session = await requireCustomer();
  const block = await getPurchaseBlock(session.user.id);
  if (block) return { success: false, error: block.error };

  const invoiceId = String(input?.invoiceId ?? "");
  const cardId = String(input?.cardId ?? "");
  if (!invoiceId || !cardId) return { success: false, error: "Fatura veya kart seçilmedi" };

  const limit = await checkRateLimit({ key: `saved-card-pay:${session.user.id}`, limit: 5, windowMs: 15 * 60 * 1000 });
  if (!limit.allowed) return { success: false, error: "Çok fazla deneme yapıldı. Lütfen 15 dakika sonra tekrar deneyin." };

  try {
    const meta = await getRequestMeta();
    const { db } = await import("@/lib/db");
    const card = await db.savedCard.findUnique({ where: { id: cardId }, select: { userId: true } });
    if (!card || card.userId !== session.user.id) return { success: false, error: "Kart bulunamadı" };
    const { getPaymentBlock } = await import("@/lib/fraud/evaluate");
    const reviewBlock = await getPaymentBlock([invoiceId]);
    if (reviewBlock) return { success: false, error: reviewBlock };

    const result = await chargeInvoiceWithSavedCard({
      invoiceId,
      cardId,
      kind: "MANUAL",
      // Double clicks are stopped by the in-flight check under the invoice lock.
      idempotencyKey: `manual:${invoiceId}:${randomUUID()}`,
      ip: meta.ip,
    });

    revalidatePath(`/musteri/panel/faturalar/${invoiceId}`);
    revalidatePath("/musteri/panel/faturalar");

    switch (result.status) {
      case "succeeded":
        return { success: true, message: "Ödemeniz alındı, faturanız ödendi" };
      case "pending":
        return {
          success: true,
          message: "Ödemeniz kontrol ediliyor. Kartınızdan çekim yapıldıysa faturanız kısa sürede güncellenecek.",
        };
      case "failed":
        return { success: false, error: `Ödeme alınamadı: ${result.message}` };
      case "duplicate":
        return { success: false, error: "Ödeme zaten işleniyor" };
      case "skipped":
        return {
          success: false,
          error:
            result.reason === "invoice-not-payable" || result.reason === "nothing-due"
              ? "Bu fatura için ödenecek tutar yok"
              : "Bu kartla şu anda ödeme yapılamıyor",
        };
    }
  } catch (error) {
    return failure(error, "Ödeme tamamlanamadı");
  }
}
