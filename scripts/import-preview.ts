/**
 * Dry run of the infrastructure import (Faz 2.7): lists the source through a
 * module instance (read-only API calls) and prints the proposed mapping —
 * customer / product / billing / status — without writing anything to the
 * database or the remote system. Same rules as /yonetim/ice-aktar.
 *
 *   pnpm import:preview -- --source=whm --instance=<moduleInstanceId>
 *   pnpm import:preview -- --source=proxmox --instance=<id> --json
 *   pnpm import:preview -- --source=registrar --instance=<id>
 *
 * Output contains customer e-mails/domains: don't paste it into tickets or commits.
 */
import type { ImportSourceKind } from "@prisma/client";
import { db } from "@/lib/db";
import { loadMatchContext } from "@/lib/imports/context";
import { summarizePreview } from "@/lib/imports/preview";
import { fetchSourceRecords } from "@/lib/imports/sources";
import { getInstance } from "@/lib/modules/instances";

const SOURCES: Record<string, ImportSourceKind> = { whm: "WHM", proxmox: "PROXMOX", registrar: "REGISTRAR", gri: "REGISTRAR" };

function arg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

function pad(value: string, width: number) {
  return value.length > width ? `${value.slice(0, width - 1)}…` : value.padEnd(width);
}

async function main() {
  const source = SOURCES[(arg("source") ?? "").toLowerCase()];
  const instanceId = arg("instance");
  if (!source || !instanceId) {
    console.error("Kullanım: pnpm import:preview -- --source=whm|proxmox|registrar --instance=<moduleInstanceId> [--json]");
    process.exit(2);
  }
  const instance = await getInstance(instanceId);
  if (!instance) throw new Error(`Modül örneği bulunamadı: ${instanceId}`);

  const records = await fetchSourceRecords(source, instance);
  const summary = summarizePreview(records, await loadMatchContext(instance.id));

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(`${instance.label} (${instance.moduleId}) — ${source}, ${summary.total} kayıt\n`);
    console.log(`${pad("UZAK KİMLİK", 16)} ${pad("AD", 28)} ${pad("İŞLEM", 7)} ${pad("MÜŞTERİ", 34)} ${pad("ÜRÜN", 28)} ${pad("FATURALAMA", 26)} DURUM`);
    for (const line of summary.lines) {
      console.log(
        `${pad(line.remoteId, 16)} ${pad(line.label, 28)} ${pad(line.ready || line.action !== "import" ? line.action : "eksik", 7)} ${pad(line.customer, 34)} ${pad(line.product, 28)} ${pad(line.billing, 26)} ${line.status}`
      );
      for (const note of line.notes) console.log(`${" ".repeat(17)}↳ ${note}`);
    }
    console.log(
      `\nHazır: ${summary.ready} · Eksik: ${summary.needsAttention} · Bağlanacak: ${summary.link} · Zaten aktarılmış: ${summary.alreadyImported} · Askıda: ${summary.suspended}`
    );
    console.log(
      `Müşteri — e-posta: ${summary.customers.byEmail}, alan adı: ${summary.customers.byDomain}, yeni: ${summary.customers.new}, yok: ${summary.customers.none}` +
        (source === "REGISTRAR" ? "" : ` · Ürün — eşleşen: ${summary.products.matched}, eşleşmeyen: ${summary.products.unmatched}`)
    );
  }
  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await db.$disconnect();
  process.exit(1);
});
