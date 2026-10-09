/**
 * Loads an offline IP → country table into ip_country_ranges (fraud rule
 * "IP ülkesi Türkiye dışı", docs/fraud-kyc.md). Replaces the whole table in
 * one transaction, so lookups never see a half-loaded table.
 *
 * Source (free, no license key): db-ip.com "IP to Country Lite" CSV,
 * CC BY 4.0 — https://db-ip.com/db/download/ip-to-country-lite
 * (dbip-country-lite-YYYY-MM.csv.gz, monthly). Lines: ip_start,ip_end,country
 * (IPv4 and IPv6). IP2Location LITE DB1 CSV ("from","to","CC","name" as
 * integers, IPv4) is accepted too.
 *
 *   pnpm fraud:load-ip-db ./dbip-country-lite-2026-10.csv.gz
 *   pnpm fraud:load-ip-db ./file.csv --dry-run     # parse + count only
 *
 * The file is read locally; download it yourself (monthly is enough).
 */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { parseIp } from "@/lib/fraud/ip-country";

type Row = { version: number; ipFrom: Prisma.Decimal; ipTo: Prisma.Decimal; country: string };

const BATCH = 5000;

function unquote(value: string) {
  return value.trim().replace(/^"|"$/g, "");
}

export function parseIpCountryLine(line: string): Row | null {
  const fields = line.split(",").map(unquote);
  if (fields.length < 3) return null;
  const [start, end, country] = fields;
  const code = country.toUpperCase();
  if (!/^[A-Z][A-Z0-9]$/.test(code) || code === "ZZ" || code === "-") return null;

  if (/^\d+$/.test(start) && /^\d+$/.test(end)) {
    // IP2Location integer ranges (IPv4).
    const from = BigInt(start);
    const to = BigInt(end);
    if (to > BigInt(0xffffffff) || from > to) return null;
    return { version: 4, ipFrom: new Prisma.Decimal(from.toString()), ipTo: new Prisma.Decimal(to.toString()), country: code };
  }

  const from = parseIp(start);
  const to = parseIp(end);
  if (!from || !to || from.version !== to.version || from.value > to.value) return null;
  return {
    version: from.version,
    ipFrom: new Prisma.Decimal(from.value.toString()),
    ipTo: new Prisma.Decimal(to.value.toString()),
    country: code,
  };
}

async function readRows(path: string): Promise<Row[]> {
  const input = createReadStream(path);
  const stream = path.endsWith(".gz") ? input.pipe(createGunzip()) : input;
  const rows: Row[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for await (const line of createInterface({ input: stream, crlfDelay: Infinity })) {
    if (!line.trim() || line.startsWith("#")) continue;
    const row = parseIpCountryLine(line);
    if (!row) {
      skipped += 1;
      continue;
    }
    const key = `${row.version}:${row.ipFrom.toString()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push(row);
  }
  console.log(`${rows.length} aralık okundu, ${skipped} satır atlandı.`);
  return rows;
}

async function main() {
  const path = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  if (!path) {
    console.error("Kullanım: pnpm fraud:load-ip-db <dbip-country-lite.csv[.gz]> [--dry-run]");
    process.exit(1);
  }
  const rows = await readRows(path);
  if (rows.length === 0) throw new Error("Dosyada geçerli satır yok");
  if (process.argv.includes("--dry-run")) return;

  await db.$transaction(
    async (tx) => {
      await tx.ipCountryRange.deleteMany({});
      for (let i = 0; i < rows.length; i += BATCH) {
        await tx.ipCountryRange.createMany({ data: rows.slice(i, i + BATCH) });
      }
    },
    { timeout: 15 * 60 * 1000, maxWait: 30_000 }
  );
  console.log(`ip_country_ranges güncellendi (${rows.length} satır).`);
}

if (process.argv[1]?.includes("load-ip-country-db")) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
