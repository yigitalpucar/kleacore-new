"use server";

import { revalidatePath } from "next/cache";
import type { DataRequestStatus } from "@prisma/client";
import { logActivity } from "@/lib/activity-log";
import { applyAnonymization, previewAnonymizationForRequest } from "@/lib/privacy/anonymize";
import { generateDataExport } from "@/lib/privacy/export";
import { DATA_REQUEST_STATUSES } from "@/lib/privacy/labels";
import {
  addDataRequestNote,
  DataRequestError,
  respondToDataRequest,
  setDataRequestStatus,
} from "@/lib/privacy/requests";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { dataRequestResponseSchema } from "@/lib/validations/privacy";

const BASE = "/yonetim/kvkk-talepleri";

function actorOf(session: { user: { id: string; name?: string | null; email?: string | null } }) {
  return { id: session.user.id, name: session.user.name || session.user.email || "Yönetici" };
}

function failure(error: unknown, fallback: string) {
  if (error instanceof DataRequestError) return { success: false as const, error: error.message };
  console.error("[KVKK admin]", error);
  return { success: false as const, error: fallback };
}

function refresh(requestId: string) {
  revalidatePath(BASE);
  revalidatePath(`${BASE}/${requestId}`);
}

export async function setDataRequestStatusAction(requestId: string, status: string) {
  const session = await requirePermission("privacy.manage");
  if (!(DATA_REQUEST_STATUSES as readonly string[]).includes(status)) {
    return { success: false, error: "Geçersiz durum" };
  }
  try {
    await setDataRequestStatus(requestId, status as DataRequestStatus, actorOf(session));
    await logActivity({ userId: session.user.id, action: "privacy.status_changed", entity: "DataRequest", entityId: requestId, details: { status } });
    refresh(requestId);
    return { success: true };
  } catch (error) {
    return failure(error, "Durum güncellenemedi");
  }
}

export async function addDataRequestNoteAction(requestId: string, formData: FormData) {
  const session = await requirePermission("privacy.manage");
  try {
    await addDataRequestNote(requestId, actorOf(session), String(formData.get("body") ?? ""));
    refresh(requestId);
    return { success: true };
  } catch (error) {
    return failure(error, "Not eklenemedi");
  }
}

export async function generateDataExportAction(requestId: string) {
  const session = await requirePermission("privacy.manage");
  try {
    const result = await generateDataExport(requestId);
    await logActivity({ userId: session.user.id, action: "privacy.export_generated", entity: "DataRequest", entityId: requestId, details: result });
    refresh(requestId);
    return { success: true, sizeBytes: result.sizeBytes };
  } catch (error) {
    return failure(error, "Veri kopyası hazırlanamadı");
  }
}

/** Dry run: nothing is written. */
export async function previewAnonymizationAction(requestId: string) {
  await requirePermission("privacy.manage");
  try {
    return { success: true as const, plan: await previewAnonymizationForRequest(requestId) };
  } catch (error) {
    return failure(error, "Önizleme hazırlanamadı");
  }
}

export async function applyAnonymizationAction(requestId: string, confirmEmail: string) {
  // Irreversible: ADMIN only (privacy.anonymize); SUPPORT may run the dry run.
  const session = await requirePermission("privacy.anonymize");
  try {
    const plan = await applyAnonymization(requestId, { id: session.user.id }, String(confirmEmail ?? ""));
    refresh(requestId);
    return { success: true as const, plan };
  } catch (error) {
    return failure(error, "Anonimleştirme uygulanamadı");
  }
}

export async function respondDataRequestAction(requestId: string, formData: FormData) {
  const session = await requirePermission("privacy.manage");
  const parsed = dataRequestResponseSchema.safeParse({
    outcome: formData.get("outcome"),
    responseText: formData.get("responseText"),
  });
  if (!parsed.success) return { success: false, error: parsed.error.errors[0]?.message ?? "Geçersiz yanıt" };
  try {
    await respondToDataRequest(requestId, parsed.data, actorOf(session));
    await logActivity({
      userId: session.user.id,
      action: "privacy.responded",
      entity: "DataRequest",
      entityId: requestId,
      details: { outcome: parsed.data.outcome },
    });
    refresh(requestId);
    return { success: true };
  } catch (error) {
    return failure(error, "Yanıt gönderilemedi");
  }
}
