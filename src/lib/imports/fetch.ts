/**
 * "import.fetch" job: lists the source (read-only) and writes one ImportRow
 * per remote record with the proposed mapping. Re-running replaces the rows
 * of a run that has not been applied yet.
 */
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { getInstance } from "@/lib/modules/instances";
import { loadMatchContext } from "./context";
import { buildProposal, isProposalReady } from "./mapping";
import { fetchSourceRecords, ImportSourceError } from "./sources";
import type { ImportRecord } from "./types";

const log = createLogger("imports.fetch");
const INSERT_CHUNK = 500;

export function recordLabel(record: ImportRecord) {
  if (record.kind === "account") return record.domain ?? record.username;
  return record.name;
}

function errorMessage(error: unknown) {
  if (error instanceof ImportSourceError) return error.message;
  if (error instanceof Error && error.name === "ModuleConfigError") return `Modül ayarları geçersiz: ${error.message}`;
  return "Kaynak listelenemedi (ayrıntı sunucu günlüğünde).";
}

export async function runImportFetch(runId: string) {
  const run = await db.importRun.findUnique({ where: { id: runId } });
  if (!run) return { skipped: "RUN_NOT_FOUND" };
  if (!["QUEUED", "FETCHING", "FAILED"].includes(run.status) || run.appliedAt) return { skipped: `STATUS_${run.status}` };

  await db.importRun.update({ where: { id: runId }, data: { status: "FETCHING", error: null } });

  try {
    if (!run.moduleInstanceId) throw new ImportSourceError("Modül örneği silinmiş.");
    const instance = await getInstance(run.moduleInstanceId);
    if (!instance) throw new ImportSourceError("Modül örneği bulunamadı.");

    const records = await fetchSourceRecords(run.source, instance);
    const ctx = await loadMatchContext(instance.id);

    const seen = new Set<string>();
    const rows: Prisma.ImportRowCreateManyInput[] = [];
    for (const record of records) {
      if (seen.has(record.remoteId)) continue;
      seen.add(record.remoteId);
      const proposal = buildProposal(record, ctx);
      rows.push({
        runId,
        remoteId: record.remoteId,
        label: recordLabel(record),
        data: record as unknown as Prisma.InputJsonValue,
        proposal: proposal as unknown as Prisma.InputJsonValue,
        selected: isProposalReady(record, proposal),
        status: proposal.existingId ? "SKIPPED" : "PENDING",
        error: proposal.existingId ? "Zaten içe aktarılmış." : null,
      });
    }

    await db.$transaction(async (tx) => {
      await tx.importRow.deleteMany({ where: { runId } });
      for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
        await tx.importRow.createMany({ data: rows.slice(i, i + INSERT_CHUNK) });
      }
      await tx.importRun.update({
        where: { id: runId },
        data: {
          status: "READY",
          fetchedAt: new Date(),
          totalCount: rows.length,
          skippedCount: rows.filter((row) => row.status === "SKIPPED").length,
          importedCount: 0,
          linkedCount: 0,
          failedCount: 0,
        },
      });
    });
    return { rows: rows.length };
  } catch (error) {
    log.error("import fetch failed", { runId, source: run.source, error });
    await db.importRun.update({ where: { id: runId }, data: { status: "FAILED", error: errorMessage(error) } });
    return { failed: true };
  }
}
