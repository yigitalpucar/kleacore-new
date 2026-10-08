"use server";

import type { ImportSourceKind, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/lib/activity-log";
import { db } from "@/lib/db";
import { listImportInstances } from "@/lib/imports/admin";
import { isProposalReady } from "@/lib/imports/mapping";
import { importProposalSchema, parseProposal, parseRecord } from "@/lib/imports/proposal";
import type { ImportProposal } from "@/lib/imports/types";
import { createLogger } from "@/lib/logger";
import { requireAdmin } from "@/lib/utils/auth-helpers";

const log = createLogger("actions.admin.imports");
const BASE_PATH = "/yonetim/ice-aktar";

type ActionResult<T = object> = ({ success: true } & T) | { success: false; error: string };

async function enqueueJob(name: "import.fetch" | "import.apply", importRunId: string) {
  const { enqueue } = await import("@/lib/jobs");
  await enqueue(name, { importRunId }, { singletonKey: importRunId });
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

const createRunSchema = z.object({
  source: z.enum(["WHM", "PROXMOX", "REGISTRAR"]),
  moduleInstanceId: z.string().min(1, "Modül örneği seçin."),
  sendInvites: z.boolean().default(true),
});

export async function createImportRunAction(input: z.input<typeof createRunSchema>): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdmin();
  const parsed = createRunSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Geçersiz giriş." };

  const option = (await listImportInstances()).find(
    (o) => o.id === parsed.data.moduleInstanceId && o.source === parsed.data.source
  );
  if (!option) return { success: false, error: "Seçilen modül örneği bu kaynakla kullanılamaz." };
  if (!option.supported) return { success: false, error: `${option.moduleName} modülü listelemeyi desteklemiyor.` };

  const run = await db.importRun.create({
    data: {
      source: parsed.data.source as ImportSourceKind,
      moduleInstanceId: option.id,
      instanceLabel: option.label,
      sendInvites: parsed.data.sendInvites,
      createdById: session.user.id,
    },
    select: { id: true },
  });
  try {
    await enqueueJob("import.fetch", run.id);
  } catch (error) {
    log.error("import.fetch enqueue failed", { runId: run.id, error });
    await db.importRun.update({ where: { id: run.id }, data: { status: "FAILED", error: "Arka plan işi kuyruğa alınamadı." } });
    return { success: false, error: "Arka plan işi kuyruğa alınamadı." };
  }
  await logActivity({
    userId: session.user.id,
    action: "IMPORT_RUN_CREATED",
    entity: "ImportRun",
    entityId: run.id,
    details: { source: parsed.data.source, moduleInstanceId: option.id },
  });
  revalidatePath(BASE_PATH);
  return { success: true, id: run.id };
}

export async function refetchImportRunAction(runId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const run = await db.importRun.findUnique({ where: { id: runId }, select: { status: true, appliedAt: true } });
  if (!run) return { success: false, error: "Kayıt bulunamadı." };
  if (run.appliedAt || run.status === "IMPORTING" || run.status === "FETCHING") {
    return { success: false, error: "İçe aktarılmış veya işlenmekte olan bir çalıştırma yeniden listelenemez; yeni bir çalıştırma başlatın." };
  }
  await db.importRun.update({ where: { id: runId }, data: { status: "QUEUED", error: null } });
  try {
    await enqueueJob("import.fetch", runId);
  } catch (error) {
    log.error("import.fetch enqueue failed", { runId, error });
    await db.importRun.update({ where: { id: runId }, data: { status: "FAILED", error: "Arka plan işi kuyruğa alınamadı." } });
    return { success: false, error: "Arka plan işi kuyruğa alınamadı." };
  }
  await logActivity({ userId: session.user.id, action: "IMPORT_RUN_REFETCH", entity: "ImportRun", entityId: runId });
  revalidatePath(`${BASE_PATH}/${runId}`);
  return { success: true };
}

export async function startImportApplyAction(runId: string): Promise<ActionResult<{ selected: number }>> {
  const session = await requireAdmin();
  const run = await db.importRun.findUnique({ where: { id: runId }, select: { status: true } });
  if (!run) return { success: false, error: "Kayıt bulunamadı." };
  if (run.status !== "READY" && run.status !== "COMPLETED") {
    return { success: false, error: "Önizleme hazır değil veya içe aktarma sürüyor." };
  }
  const selected = await db.importRow.count({ where: { runId, selected: true, status: { in: ["PENDING", "FAILED"] } } });
  if (selected === 0) return { success: false, error: "İçe aktarılacak satır seçilmedi." };

  // Status guard: two clicks cannot start two jobs.
  const claimed = await db.importRun.updateMany({
    where: { id: runId, status: { in: ["READY", "COMPLETED"] } },
    data: { status: "IMPORTING", appliedById: session.user.id, error: null },
  });
  if (claimed.count !== 1) return { success: false, error: "İçe aktarma zaten başlatıldı." };
  try {
    await enqueueJob("import.apply", runId);
  } catch (error) {
    log.error("import.apply enqueue failed", { runId, error });
    await db.importRun.update({ where: { id: runId }, data: { status: run.status, error: "Arka plan işi kuyruğa alınamadı." } });
    return { success: false, error: "Arka plan işi kuyruğa alınamadı." };
  }
  await logActivity({ userId: session.user.id, action: "IMPORT_APPLY_STARTED", entity: "ImportRun", entityId: runId, details: { selected } });
  revalidatePath(`${BASE_PATH}/${runId}`);
  return { success: true, selected };
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

async function editableRow(rowId: string) {
  const row = await db.importRow.findUnique({ where: { id: rowId }, include: { run: { select: { id: true, status: true } } } });
  if (!row) return { error: "Satır bulunamadı." } as const;
  if (row.run.status !== "READY" && row.run.status !== "COMPLETED") return { error: "Bu aşamada satır düzenlenemez." } as const;
  if (row.status !== "PENDING" && row.status !== "FAILED") return { error: "İşlenmiş satır düzenlenemez." } as const;
  return { row } as const;
}

const rowEditSchema = z.object({
  action: z.enum(["import", "link", "skip"]).optional(),
  customerMode: z.enum(["keep", "existing", "new", "none"]).optional(),
  /** existing: e-mail of the customer to pick. */
  customerEmail: z.string().trim().optional(),
  newCustomer: z.object({ email: z.string(), name: z.string(), surname: z.string().optional() }).optional(),
  productId: z.string().nullable().optional(),
  billingPeriod: importProposalSchema.shape.billingPeriod.optional(),
  nextDueDate: z.string().nullable().optional(),
  amountOverride: z.string().nullable().optional(),
  serviceStatus: importProposalSchema.shape.serviceStatus.optional(),
  domainStatus: importProposalSchema.shape.domainStatus.optional(),
  autoRenew: z.boolean().optional(),
  selected: z.boolean().optional(),
});

export type ImportRowEdit = z.input<typeof rowEditSchema>;

export async function updateImportRowAction(rowId: string, input: ImportRowEdit): Promise<ActionResult<{ ready: boolean }>> {
  await requireAdmin();
  const parsed = rowEditSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Geçersiz giriş." };
  const found = await editableRow(rowId);
  if ("error" in found) return { success: false, error: found.error ?? "Satır düzenlenemez." };
  const { row } = found;
  const edit = parsed.data;
  const record = parseRecord(row.data);
  const current = parseProposal(row.proposal);
  const next: ImportProposal = { ...current };

  if (edit.action) {
    if (edit.action === "link" && !current.linkServiceId) return { success: false, error: "Bu satır için bağlanacak mevcut hizmet yok." };
    next.action = edit.action;
  }

  if (edit.customerMode === "existing") {
    const email = edit.customerEmail?.toLowerCase();
    if (!email) return { success: false, error: "Müşteri e-postası girin." };
    const user = await db.user.findUnique({ where: { email }, select: { id: true, email: true, role: true, name: true, surname: true, companyName: true } });
    if (!user || user.role !== "CUSTOMER") return { success: false, error: "Bu e-postayla kayıtlı müşteri yok." };
    next.customer = {
      mode: "existing",
      userId: user.id,
      email: user.email,
      label: user.companyName?.trim() || `${user.name} ${user.surname}`.trim() || user.email,
      matchedBy: "manual",
    };
  } else if (edit.customerMode === "new") {
    if (!edit.newCustomer) return { success: false, error: "Yeni müşteri bilgilerini girin." };
    const email = edit.newCustomer.email.trim().toLowerCase();
    const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) return { success: false, error: "Bu e-posta zaten kayıtlı; mevcut müşteri olarak seçin." };
    next.customer = { mode: "new", email, name: edit.newCustomer.name, surname: edit.newCustomer.surname ?? "" };
  } else if (edit.customerMode === "none") {
    next.customer = { mode: "none" };
  }

  if (edit.productId !== undefined) {
    if (edit.productId) {
      const product = await db.product.findUnique({ where: { id: edit.productId }, select: { id: true } });
      if (!product) return { success: false, error: "Ürün bulunamadı." };
    }
    if (edit.productId !== current.productId) {
      next.productId = edit.productId || null;
      next.productMatchedBy = edit.productId ? "manual" : null;
    }
  }
  if (edit.billingPeriod) next.billingPeriod = edit.billingPeriod;
  if (edit.nextDueDate !== undefined) next.nextDueDate = edit.nextDueDate || null;
  if (edit.amountOverride !== undefined) next.amountOverride = edit.amountOverride?.trim() ? edit.amountOverride.trim() : null;
  if (edit.serviceStatus) next.serviceStatus = edit.serviceStatus;
  if (edit.domainStatus) next.domainStatus = edit.domainStatus;
  if (edit.autoRenew !== undefined) next.autoRenew = edit.autoRenew;

  const validated = importProposalSchema.safeParse(next);
  if (!validated.success) return { success: false, error: validated.error.issues[0]?.message ?? "Geçersiz eşleme." };
  const proposal = validated.data as ImportProposal;
  const ready = isProposalReady(record, proposal);

  await db.importRow.update({
    where: { id: rowId },
    data: {
      proposal: proposal as unknown as Prisma.InputJsonValue,
      // Selecting an incomplete row is allowed (it fails with a clear error) but editing never auto-selects.
      ...(edit.selected !== undefined ? { selected: edit.selected } : proposal.action === "skip" ? { selected: false } : {}),
    },
  });
  revalidatePath(`${BASE_PATH}/${row.runId}`);
  return { success: true, ready };
}

/** Select / unselect rows: explicit ids, or every ready pending row of the run ("ready"). */
export async function setImportRowsSelectedAction(
  runId: string,
  input: { rowIds?: string[]; scope?: "ready" | "all"; selected: boolean }
): Promise<ActionResult<{ count: number }>> {
  await requireAdmin();
  const run = await db.importRun.findUnique({ where: { id: runId }, select: { status: true } });
  if (!run || (run.status !== "READY" && run.status !== "COMPLETED")) return { success: false, error: "Bu aşamada seçim değiştirilemez." };

  let ids = input.rowIds ?? [];
  if (input.scope) {
    const rows = await db.importRow.findMany({
      where: { runId, status: { in: ["PENDING", "FAILED"] } },
      select: { id: true, data: true, proposal: true },
    });
    ids = rows
      .filter((row) => input.scope === "all" || !input.selected || isProposalReady(parseRecord(row.data), parseProposal(row.proposal)))
      .map((row) => row.id);
  }
  const updated = await db.importRow.updateMany({
    where: { runId, id: { in: ids }, status: { in: ["PENDING", "FAILED"] } },
    data: { selected: input.selected },
  });
  revalidatePath(`${BASE_PATH}/${runId}`);
  return { success: true, count: updated.count };
}
