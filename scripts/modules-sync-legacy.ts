/**
 * Mirrors the legacy Setting-backed configs (cPanel/WHM, Gri registrar,
 * Virtualizor) into ModuleInstance rows and verifies that each mirror
 * resolves to the same config as Settings. Idempotent; prints field names
 * only, never values. Same as /yonetim/moduller → "Eski ayarları içe aktar".
 *
 *   pnpm modules:sync-legacy            # uses .env (local DB)
 *   pnpm modules:sync-legacy --verify   # only compare, write nothing
 */
import { db } from "@/lib/db";
import { syncLegacyModuleInstances, verifyLegacyModuleInstances } from "@/lib/modules/legacy";

async function main() {
  const verifyOnly = process.argv.includes("--verify");
  if (!verifyOnly) {
    for (const report of await syncLegacyModuleInstances()) {
      console.log(`${report.source.padEnd(10)} ${report.action}${report.reason ? ` — ${report.reason}` : ""}${report.linkedServers ? ` (${report.linkedServers} sunucu bağlandı)` : ""}`);
    }
  }
  let mismatch = false;
  for (const result of await verifyLegacyModuleInstances()) {
    const status = result.reason ? `— ${result.reason}` : result.equal ? "eşit" : `FARKLI: ${result.differences.join(", ")}`;
    if (result.instanceId && !result.equal) mismatch = true;
    console.log(`verify ${result.source.padEnd(10)} ${status}`);
  }
  await db.$disconnect();
  process.exit(mismatch ? 1 : 0);
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await db.$disconnect();
  process.exit(1);
});
