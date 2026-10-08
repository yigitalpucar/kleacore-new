import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";
import { csvContentDisposition, toCsv } from "@/lib/reports/csv";
import { parseReportRange } from "@/lib/reports/range";
import { REPORT_TABLES, isReportTableKey } from "@/lib/reports/tables";
import { error, forbidden, unauthorized } from "@/lib/utils/api-response";
import { checkApiPermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = createLogger("reports.csv");

/** One report table as CSV (UTF-8 BOM, `;`, decimal comma): ?table=kdv&from=…&to=… or &period=… */
export async function GET(request: NextRequest) {
  const access = await checkApiPermission("reports.view");
  if (!access.ok) return access.status === 401 ? unauthorized() : forbidden();

  const table = request.nextUrl.searchParams.get("table");
  if (!isReportTableKey(table)) return error("Bilinmeyen rapor tablosu", 400);

  const range = parseReportRange(request.nextUrl.searchParams);
  try {
    const rows = await REPORT_TABLES[table].build(range);
    const fileName = `${table}_${range.fromDay}_${range.toDay}.csv`;
    return new NextResponse(toCsv(rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": csvContentDisposition(fileName),
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    log.error("report csv failed", { table, error: err });
    return error("Rapor oluşturulamadı", 500);
  }
}
