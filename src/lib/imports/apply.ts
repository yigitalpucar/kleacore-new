/**
 * "import.apply" job: turns the selected rows of an ImportRun into Service /
 * Domain rows bound to the module instance.
 *
 * Guarantees (docs/modules.md §8):
 * - No remote call at all, no invoice, no provisioning job.
 * - Idempotent: a remoteId already bound on the instance (unique
 *   services(moduleInstanceId, remoteId)) or an existing domain name is
 *   SKIPPED, so re-running a run — or importing the same source again — never
 *   duplicates anything.
 * - Each row runs in its own transaction; a failing row is recorded (FAILED +
 *   error) and the run continues.
 * - Existing IPs found in an IPAM pool are marked ASSIGNED to the new service
 *   only when FREE; an address already ASSIGNED/RESERVED is never reassigned
 *   (warning on the row).
 */
import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { Prisma, type ImportRow, type ImportRun } from "@prisma/client";
import { generateUniqueAffiliateCode } from "@/lib/affiliate";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { getModule } from "@/lib/modules/registry";
import { loadProducts } from "./context";
import { sendAccountInvite } from "./invite";
import { normalizeDomain, resolveServiceAmount, startOfDay, type ProductCandidate } from "./mapping";
import { parseProposal, parseRecord } from "./proposal";
import { IMPORT_SUSPEND_REASON, type CustomerProposal, type ImportRecord } from "./types";

const log = createLogger("imports.apply");

type Tx = Prisma.TransactionClient;

export class ImportRowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportRowError";
  }
}

export interface RowOutcome {
  status: "IMPORTED" | "LINKED" | "SKIPPED";
  serviceId?: string | null;
  domainId?: string | null;
  customerId?: string | null;
  createdCustomer?: boolean;
  warnings?: string[];
  message?: string | null;
}

export interface ApplyEnv {
  run: Pick<ImportRun, "id" | "source" | "moduleInstanceId">;
  instanceModuleId: string;
  products: Map<string, ProductCandidate>;
  now: Date;
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// ---------------------------------------------------------------------------
// Customer
// ---------------------------------------------------------------------------

async function resolveCustomer(tx: Tx, proposal: CustomerProposal): Promise<{ id: string; created: boolean }> {
  if (proposal.mode === "none") throw new ImportRowError("Müşteri seçilmedi.");
  if (proposal.mode === "existing") {
    const user = await tx.user.findUnique({ where: { id: proposal.userId }, select: { id: true, role: true } });
    if (!user || user.role !== "CUSTOMER") throw new ImportRowError("Seçilen müşteri bulunamadı.");
    return { id: user.id, created: false };
  }
  // New customer: reuse an account created meanwhile (same e-mail, e.g. by an earlier row of this run).
  const email = proposal.email.trim().toLowerCase();
  const existing = await tx.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (existing) {
    if (existing.role !== "CUSTOMER") throw new ImportRowError("Bu e-posta bir yönetici hesabına ait.");
    return { id: existing.id, created: false };
  }
  // No password: an unusable random hash. The invitation link sets the first one.
  const password = await hash(randomBytes(32).toString("hex"), 10);
  const user = await tx.user.create({
    data: {
      email,
      password,
      name: proposal.name.trim(),
      surname: proposal.surname?.trim() ?? "",
      role: "CUSTOMER",
      status: "ACTIVE",
      affiliateCode: await generateUniqueAffiliateCode(tx, proposal.name),
      // The address comes from the existing hosting relationship; the invite proves it.
      emailVerifiedAt: new Date(),
    },
    select: { id: true },
  });
  return { id: user.id, created: true };
}

// ---------------------------------------------------------------------------
// IPAM
// ---------------------------------------------------------------------------

/** Marks the service's existing IPs ASSIGNED where they are FREE in a pool; never reassigns. */
export async function claimExistingIps(tx: Tx, serviceId: string, addresses: string[], now: Date) {
  const warnings: string[] = [];
  for (const address of addresses) {
    const row = await tx.ipAddress.findUnique({ where: { address }, select: { id: true, status: true, serviceId: true } });
    if (!row) continue; // not in any pool
    if (row.status === "ASSIGNED" && row.serviceId === serviceId) continue;
    if (row.status !== "FREE") {
      warnings.push(
        row.status === "ASSIGNED"
          ? `${address} başka bir hizmete atanmış; değiştirilmedi.`
          : `${address} havuzda ayrılmış (RESERVED); değiştirilmedi.`
      );
      continue;
    }
    // Same guard as assignIpManually: only a FREE row is claimed (cool-down ignored: the address is already in use by this VM).
    const claimed = await tx.ipAddress.updateMany({
      where: { id: row.id, status: "FREE" },
      data: { status: "ASSIGNED", serviceId, assignedAt: now, releasedAt: null, cooldownUntil: null },
    });
    if (claimed.count !== 1) warnings.push(`${address} aynı anda başka bir işlemle alındı; değiştirilmedi.`);
  }
  return warnings;
}

// ---------------------------------------------------------------------------
// One row
// ---------------------------------------------------------------------------

function parseDueDate(value: string | null, now: Date, options: { allowPast: boolean }) {
  if (!value) throw new ImportRowError("Vade / bitiş tarihi gerekli.");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new ImportRowError("Tarih geçersiz.");
  if (!options.allowPast && date.getTime() < startOfDay(now).getTime()) {
    throw new ImportRowError("Sonraki vade bugünden önce olamaz (geçmiş dönemler faturalanmaz).");
  }
  return date;
}

function serviceFields(record: ImportRecord) {
  if (record.kind === "account") {
    return {
      label: record.domain ?? record.username,
      domain: record.domain,
      username: record.username,
      ipAddress: record.ipAddresses[0] ?? null,
      diskUsed: record.diskUsedMB !== null ? Math.round((record.diskUsedMB / 1024) * 100) / 100 : null,
      diskLimit: record.diskLimitMB !== null ? Math.round((record.diskLimitMB / 1024) * 100) / 100 : null,
    };
  }
  if (record.kind === "vm") {
    return {
      label: record.name,
      domain: normalizeDomain(record.name),
      username: null,
      ipAddress: record.ipAddresses[0] ?? null,
      diskUsed: null,
      diskLimit: record.diskGB,
    };
  }
  throw new ImportRowError("Kayıt hizmet değil.");
}

/**
 * Service.moduleData for an imported VM, shaped like the Proxmox module's
 * state (ProxmoxServiceState): VMID + node, provisioning done, `imported`
 * (the import is the ownership proof — the VM has no KLEACORE owner marker;
 * reinstall is refused) and no initial password (passwordEnc absent).
 */
export function importedModuleData(record: ImportRecord, moduleId: string, now: Date, existing?: unknown) {
  if (record.kind !== "vm" || moduleId !== "proxmox") return undefined;
  const base = existing && typeof existing === "object" && !Array.isArray(existing) ? (existing as Record<string, unknown>) : {};
  const previous = base[moduleId] && typeof base[moduleId] === "object" ? (base[moduleId] as Record<string, unknown>) : {};
  return {
    ...base,
    [moduleId]: {
      ...previous,
      vmid: Number(record.remoteId),
      ...(record.node ? { node: record.node } : {}),
      ...(record.ipAddresses[0] ? { ipAddress: record.ipAddresses[0] } : {}),
      step: "done",
      imported: true,
      importedAt: now.toISOString(),
    },
  } as Prisma.InputJsonValue;
}

async function applyServiceRow(tx: Tx, row: ImportRow, record: ImportRecord, env: ApplyEnv): Promise<RowOutcome> {
  const proposal = parseProposal(row.proposal);
  const instanceId = env.run.moduleInstanceId!;

  const existing = await tx.service.findFirst({
    where: { moduleInstanceId: instanceId, remoteId: record.remoteId },
    select: { id: true, customerId: true },
  });
  if (existing) {
    return { status: "SKIPPED", serviceId: existing.id, customerId: existing.customerId, message: "Zaten içe aktarılmış." };
  }

  if (proposal.action === "link") {
    if (!proposal.linkServiceId) throw new ImportRowError("Bağlanacak hizmet seçilmedi.");
    const current = await tx.service.findUnique({ where: { id: proposal.linkServiceId }, select: { moduleData: true } });
    const moduleData = importedModuleData(record, env.instanceModuleId, env.now, current?.moduleData);
    const linked = await tx.service.updateMany({
      where: { id: proposal.linkServiceId, moduleInstanceId: null },
      data: { moduleInstanceId: instanceId, remoteId: record.remoteId, ...(moduleData ? { moduleData } : {}) },
    });
    if (linked.count !== 1) throw new ImportRowError("Hizmet bulunamadı veya başka bir örneğe bağlı.");
    const service = await tx.service.findUniqueOrThrow({ where: { id: proposal.linkServiceId }, select: { customerId: true } });
    return { status: "LINKED", serviceId: proposal.linkServiceId, customerId: service.customerId };
  }

  const product = proposal.productId ? env.products.get(proposal.productId) : undefined;
  if (!product) throw new ImportRowError("Ürün seçilmedi.");
  const nextDueDate = parseDueDate(proposal.nextDueDate, env.now, { allowPast: false });
  let amount: string;
  try {
    amount = resolveServiceAmount(product, proposal.billingPeriod, proposal.amountOverride);
  } catch (error) {
    throw new ImportRowError(error instanceof Error ? error.message : "Fiyat geçersiz.");
  }

  const customer = await resolveCustomer(tx, proposal.customer);
  const suspended = proposal.serviceStatus === "SUSPENDED";
  const fields = serviceFields(record);
  const moduleData = importedModuleData(record, env.instanceModuleId, env.now);
  const service = await tx.service.create({
    data: {
      customerId: customer.id,
      productId: product.id,
      ...fields,
      moduleInstanceId: instanceId,
      remoteId: record.remoteId,
      ...(moduleData ? { moduleData } : {}),
      billingPeriod: proposal.billingPeriod,
      amount,
      nextDueDate,
      expiresAt: nextDueDate,
      status: proposal.serviceStatus,
      suspendedAt: suspended ? env.now : null,
      suspendReason: suspended ? IMPORT_SUSPEND_REASON : null,
    },
    select: { id: true },
  });

  // WHM account IPs are the server's shared IPs: only VM addresses are claimed in IPAM.
  const warnings = record.kind === "vm" ? await claimExistingIps(tx, service.id, record.ipAddresses, env.now) : [];
  return { status: "IMPORTED", serviceId: service.id, customerId: customer.id, createdCustomer: customer.created, warnings };
}

async function applyDomainRow(tx: Tx, row: ImportRow, record: ImportRecord, env: ApplyEnv): Promise<RowOutcome> {
  if (record.kind !== "domain") throw new ImportRowError("Kayıt alan adı değil.");
  const proposal = parseProposal(row.proposal);
  const existing = await tx.domain.findUnique({ where: { name: record.name }, select: { id: true, customerId: true } });
  if (existing) return { status: "SKIPPED", domainId: existing.id, customerId: existing.customerId, message: "Alan adı zaten kayıtlı." };

  // Real registrar expiry: may be in the past (expired / grace); no invoice is created here.
  const expiresAt = parseDueDate(proposal.nextDueDate, env.now, { allowPast: true });
  const customer = await resolveCustomer(tx, proposal.customer);
  const domain = await tx.domain.create({
    data: {
      customerId: customer.id,
      name: record.name,
      registrar: getModule(env.instanceModuleId)?.name ?? env.instanceModuleId,
      expiresAt,
      autoRenew: proposal.autoRenew,
      status: proposal.domainStatus,
      nameservers: record.nameservers,
      moduleInstanceId: env.run.moduleInstanceId,
      lastSyncedAt: env.now,
    },
    select: { id: true },
  });
  return { status: "IMPORTED", domainId: domain.id, customerId: customer.id, createdCustomer: customer.created };
}

/** Applies one row in its own transaction. Throws ImportRowError (or anything) on failure. */
export async function applyImportRow(row: ImportRow, env: ApplyEnv): Promise<RowOutcome> {
  const record = parseRecord(row.data);
  const proposal = parseProposal(row.proposal);
  if (proposal.action === "skip") return { status: "SKIPPED", message: "Atlandı (yönetici)." };
  try {
    return await db.$transaction((tx) =>
      record.kind === "domain" ? applyDomainRow(tx, row, record, env) : applyServiceRow(tx, row, record, env)
    );
  } catch (error) {
    // A concurrent run imported the same remote id / domain first.
    if (isUniqueViolation(error)) return { status: "SKIPPED", message: "Zaten içe aktarılmış." };
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export function rowErrorMessage(error: unknown) {
  if (error instanceof ImportRowError) return error.message;
  if (error instanceof Error && error.name === "ZodError") return "Satır eşlemesi geçersiz; satırı düzenleyip kaydedin.";
  return "Beklenmeyen hata (ayrıntı sunucu günlüğünde).";
}

/**
 * Applies rows one by one; a failing row never aborts the others. Exported
 * with an injectable row function for tests.
 */
export async function applyRows(
  rows: ImportRow[],
  applyOne: (row: ImportRow) => Promise<RowOutcome>,
  record: (row: ImportRow, result: { outcome?: RowOutcome; error?: string }) => Promise<void>
) {
  const createdCustomers = new Set<string>();
  for (const row of rows) {
    try {
      const outcome = await applyOne(row);
      if (outcome.createdCustomer && outcome.customerId) createdCustomers.add(outcome.customerId);
      await record(row, { outcome });
    } catch (error) {
      log.warn("import row failed", { rowId: row.id, remoteId: row.remoteId, error });
      await record(row, { error: rowErrorMessage(error) });
    }
  }
  return { createdCustomers };
}

export async function runImportApply(runId: string) {
  const run = await db.importRun.findUnique({ where: { id: runId }, include: { moduleInstance: { select: { moduleId: true } } } });
  if (!run) return { skipped: "RUN_NOT_FOUND" };
  if (run.status !== "IMPORTING") return { skipped: `STATUS_${run.status}` };
  if (!run.moduleInstanceId || !run.moduleInstance) {
    await db.importRun.update({ where: { id: runId }, data: { status: "FAILED", error: "Modül örneği silinmiş." } });
    return { failed: true };
  }

  const now = new Date();
  const env: ApplyEnv = {
    run,
    instanceModuleId: run.moduleInstance.moduleId,
    products: new Map((await loadProducts()).map((p) => [p.id, p])),
    now,
  };
  const rows = await db.importRow.findMany({
    where: { runId, selected: true, status: { in: ["PENDING", "FAILED"] } },
    orderBy: { createdAt: "asc" },
  });

  const { createdCustomers } = await applyRows(
    rows,
    (row) => applyImportRow(row, env),
    async (row, { outcome, error }) => {
      await db.importRow.update({
        where: { id: row.id },
        data: outcome
          ? {
              status: outcome.status,
              error: outcome.message ?? null,
              warnings: outcome.warnings ?? [],
              serviceId: outcome.serviceId ?? null,
              domainId: outcome.domainId ?? null,
              customerId: outcome.customerId ?? null,
              createdCustomer: outcome.createdCustomer ?? false,
              importedAt: outcome.status === "IMPORTED" || outcome.status === "LINKED" ? now : null,
            }
          : { status: "FAILED", error: error ?? "Bilinmeyen hata", warnings: [] },
      });
    }
  );

  if (run.sendInvites) {
    for (const userId of createdCustomers) {
      const summary = await db.importRow.count({ where: { runId, customerId: userId, status: "IMPORTED" } });
      await sendAccountInvite(userId, { runId, summary: summary > 0 ? `${summary} kayıt` : undefined });
    }
  }

  const counts = await db.importRow.groupBy({ by: ["status"], where: { runId }, _count: { _all: true } });
  const count = (status: string) => counts.find((c) => c.status === status)?._count._all ?? 0;
  const createdTotal = await db.importRow.count({ where: { runId, createdCustomer: true } });
  await db.importRun.update({
    where: { id: runId },
    data: {
      status: "COMPLETED",
      appliedAt: now,
      importedCount: count("IMPORTED"),
      linkedCount: count("LINKED"),
      skippedCount: count("SKIPPED"),
      failedCount: count("FAILED"),
      createdCustomers: createdTotal,
    },
  });

  if (run.appliedById) {
    await db.activityLog
      .create({
        data: {
          userId: run.appliedById,
          action: "IMPORT_APPLIED",
          entity: "ImportRun",
          entityId: runId,
          details: {
            source: run.source,
            moduleInstanceId: run.moduleInstanceId,
            processed: rows.length,
            imported: count("IMPORTED"),
            linked: count("LINKED"),
            skipped: count("SKIPPED"),
            failed: count("FAILED"),
            createdCustomers: createdCustomers.size,
          },
        },
      })
      .catch((error: unknown) => log.warn("activity log failed", { runId, error }));
  }

  return { processed: rows.length, createdCustomers: createdCustomers.size };
}
