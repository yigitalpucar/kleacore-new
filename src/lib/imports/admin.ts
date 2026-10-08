/** Read models for /yonetim/ice-aktar (serialisable: dates as ISO strings, money as numbers). */
import type { ImportRowStatus, ImportSourceKind, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getModule } from "@/lib/modules/registry";
import { loadProducts } from "./context";
import { amountPreview, isProposalReady } from "./mapping";
import { parseProposal, parseRecord } from "./proposal";
import { IMPORT_SOURCE_MODULES, type ImportProposal, type ImportRecord } from "./types";

export const IMPORT_ROWS_PAGE_SIZE = 50;

export interface ImportInstanceOption {
  id: string;
  label: string;
  moduleId: string;
  moduleName: string;
  source: ImportSourceKind;
  isActive: boolean;
  supported: boolean;
}

/** Module instances that can feed each source (supported = the module can list). */
export async function listImportInstances(): Promise<ImportInstanceOption[]> {
  const rows = await db.moduleInstance.findMany({
    where: { kind: { in: ["server", "registrar"] } },
    orderBy: [{ kind: "asc" }, { priority: "asc" }, { createdAt: "asc" }],
    select: { id: true, label: true, moduleId: true, kind: true, isActive: true },
  });
  const out: ImportInstanceOption[] = [];
  for (const row of rows) {
    const manifest = getModule(row.moduleId);
    for (const [source, spec] of Object.entries(IMPORT_SOURCE_MODULES) as Array<[ImportSourceKind, (typeof IMPORT_SOURCE_MODULES)[ImportSourceKind]]>) {
      if (row.kind !== spec.kind) continue;
      if (spec.moduleIds.length > 0 && !spec.moduleIds.includes(row.moduleId)) continue;
      const capabilities = (manifest?.capabilities ?? []) as readonly string[];
      const supported =
        source === "WHM"
          ? capabilities.includes("listAccounts")
          : source === "REGISTRAR"
            ? capabilities.includes("listDomains")
            : Boolean(manifest); // Proxmox: module lister or the HTTP adapter over its config
      out.push({
        id: row.id,
        label: row.label,
        moduleId: row.moduleId,
        moduleName: manifest?.name ?? row.moduleId,
        source,
        isActive: row.isActive,
        supported,
      });
    }
  }
  return out;
}

export async function listImportRuns(limit = 50) {
  const runs = await db.importRun.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { createdBy: { select: { name: true, surname: true, email: true } } },
  });
  return runs.map((run) => ({
    id: run.id,
    source: run.source,
    instanceLabel: run.instanceLabel,
    status: run.status,
    totalCount: run.totalCount,
    importedCount: run.importedCount,
    linkedCount: run.linkedCount,
    skippedCount: run.skippedCount,
    failedCount: run.failedCount,
    createdBy: run.createdBy ? `${run.createdBy.name} ${run.createdBy.surname}`.trim() || run.createdBy.email : null,
    createdAt: run.createdAt.toISOString(),
    appliedAt: run.appliedAt?.toISOString() ?? null,
  }));
}

export type ImportRowFilter = "all" | "ready" | "attention" | "selected" | "done" | "failed";

function rowFilterWhere(filter: ImportRowFilter): Prisma.ImportRowWhereInput {
  switch (filter) {
    case "selected":
      return { selected: true, status: { in: ["PENDING", "FAILED"] } };
    case "done":
      return { status: { in: ["IMPORTED", "LINKED", "SKIPPED"] } };
    case "failed":
      return { status: "FAILED" };
    case "ready":
    case "attention":
      return { status: { in: ["PENDING", "FAILED"] } };
    default:
      return {};
  }
}

export interface ImportRowView {
  id: string;
  remoteId: string;
  label: string;
  record: ImportRecord;
  proposal: ImportProposal;
  ready: boolean;
  selected: boolean;
  status: ImportRowStatus;
  error: string | null;
  warnings: string[];
  serviceId: string | null;
  domainId: string | null;
  customerId: string | null;
  amount: number | null;
}

export async function getImportRunView(runId: string, options: { page?: number; filter?: ImportRowFilter; q?: string } = {}) {
  const run = await db.importRun.findUnique({
    where: { id: runId },
    include: {
      createdBy: { select: { name: true, surname: true, email: true } },
      moduleInstance: { select: { id: true, label: true, moduleId: true } },
    },
  });
  if (!run) return null;

  const filter = options.filter ?? "all";
  const q = options.q?.trim();
  const where: Prisma.ImportRowWhereInput = {
    runId,
    ...rowFilterWhere(filter),
    ...(q ? { OR: [{ remoteId: { contains: q, mode: "insensitive" } }, { label: { contains: q, mode: "insensitive" } }] } : {}),
  };

  const [statusCounts, selectedCount, products] = await Promise.all([
    db.importRow.groupBy({ by: ["status"], where: { runId }, _count: { _all: true } }),
    db.importRow.count({ where: { runId, selected: true, status: { in: ["PENDING", "FAILED"] } } }),
    loadProducts(),
  ]);
  const productById = new Map(products.map((p) => [p.id, p]));

  // "ready" / "attention" depend on the JSON proposal: filter in memory over the pending rows.
  const needsMemoryFilter = filter === "ready" || filter === "attention";
  const page = Math.max(1, options.page ?? 1);
  const raw = await db.importRow.findMany({
    where,
    orderBy: [{ createdAt: "asc" }, { remoteId: "asc" }],
    ...(needsMemoryFilter ? {} : { skip: (page - 1) * IMPORT_ROWS_PAGE_SIZE, take: IMPORT_ROWS_PAGE_SIZE }),
  });
  let rows: ImportRowView[] = raw.map((row) => {
    const record = parseRecord(row.data);
    const proposal = parseProposal(row.proposal);
    const product = proposal.productId ? productById.get(proposal.productId) : undefined;
    return {
      id: row.id,
      remoteId: row.remoteId,
      label: row.label,
      record,
      proposal,
      ready: isProposalReady(record, proposal),
      selected: row.selected,
      status: row.status,
      error: row.error,
      warnings: row.warnings,
      serviceId: row.serviceId,
      domainId: row.domainId,
      customerId: row.customerId,
      amount: record.kind === "domain" ? null : amountPreview(product, proposal),
    };
  });
  let total = needsMemoryFilter ? 0 : await db.importRow.count({ where });
  if (needsMemoryFilter) {
    const filtered = rows.filter((row) => (filter === "ready" ? row.ready : !row.ready && row.proposal.action !== "skip"));
    total = filtered.length;
    rows = filtered.slice((page - 1) * IMPORT_ROWS_PAGE_SIZE, page * IMPORT_ROWS_PAGE_SIZE);
  }

  const count = (status: ImportRowStatus) => statusCounts.find((c) => c.status === status)?._count._all ?? 0;
  const categories = run.source === "WHM" ? ["hosting", "email"] : run.source === "PROXMOX" ? ["vds", "vps", "server", "cloud"] : [];

  return {
    run: {
      id: run.id,
      source: run.source,
      status: run.status,
      instance: run.moduleInstance,
      instanceLabel: run.instanceLabel,
      sendInvites: run.sendInvites,
      error: run.error,
      totalCount: run.totalCount,
      importedCount: run.importedCount,
      linkedCount: run.linkedCount,
      skippedCount: run.skippedCount,
      failedCount: run.failedCount,
      createdCustomers: run.createdCustomers,
      createdBy: run.createdBy ? `${run.createdBy.name} ${run.createdBy.surname}`.trim() || run.createdBy.email : null,
      createdAt: run.createdAt.toISOString(),
      fetchedAt: run.fetchedAt?.toISOString() ?? null,
      appliedAt: run.appliedAt?.toISOString() ?? null,
    },
    counts: {
      pending: count("PENDING"),
      imported: count("IMPORTED"),
      linked: count("LINKED"),
      skipped: count("SKIPPED"),
      failed: count("FAILED"),
      selected: selectedCount,
    },
    rows,
    page,
    pageCount: Math.max(1, Math.ceil(total / IMPORT_ROWS_PAGE_SIZE)),
    total,
    filter,
    q: q ?? "",
    products: products
      .filter((p) => categories.includes(p.categorySlug))
      .map((p) => ({ id: p.id, name: p.name, sku: p.sku, categorySlug: p.categorySlug })),
  };
}

export type ImportRunView = NonNullable<Awaited<ReturnType<typeof getImportRunView>>>;
