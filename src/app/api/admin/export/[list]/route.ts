import { NextRequest, NextResponse } from "next/server";
import { isAdminListKey, parseListView, type AdminListKey } from "@/lib/admin/list-views";
import { createLogger } from "@/lib/logger";
import { CSV_BOM, CSV_SEPARATOR, csvCell, csvContentDisposition } from "@/lib/reports/csv";
import { toIstanbulDay } from "@/lib/reports/range";
import { error, forbidden, unauthorized } from "@/lib/utils/api-response";
import { checkApiPermission } from "@/lib/utils/auth-helpers";
import { EXPORT_MAX_ROWS, EXPORT_SPECS, matchesView } from "./specs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const log = createLogger("admin.export");

/** The list's own view permission, on top of export.csv. */
async function checkListPermission(list: AdminListKey) {
  switch (list) {
    case "invoices":
      return checkApiPermission("invoices.view");
    case "services":
      return checkApiPermission("services.view");
    case "customers":
      return checkApiPermission("customers.view");
    case "orders":
      return checkApiPermission("orders.view");
    case "tickets":
      return checkApiPermission("tickets.view");
  }
}

type Access = Awaited<ReturnType<typeof checkApiPermission>>;
const deny = (access: Access) => (access.ok ? null : access.status === 401 ? unauthorized() : forbidden());

/**
 * GET /api/admin/export/<list>?scope=<page>&q=…&f_<filter>=… → CSV of the
 * filtered admin list (UTF-8 BOM, `;`, decimal comma; formula cells are
 * neutralised by csvCell). Streams batch by batch.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ list: string }> }) {
  const exportDenied = deny(await checkApiPermission("export.csv"));
  if (exportDenied) return exportDenied;

  const { list } = await params;
  if (!isAdminListKey(list)) return error("Bilinmeyen liste", 404);
  const listDenied = deny(await checkListPermission(list));
  if (listDenied) return listDenied;

  const spec = EXPORT_SPECS[list];
  const sp = request.nextUrl.searchParams;
  const scopeKey = sp.get("scope") ?? "all";
  const scope = spec.scopes[scopeKey];
  if (!scope) return error("Bilinmeyen liste görünümü", 400);

  const view = parseListView(sp, Object.keys(spec.filterValues));
  const q = view.q.trim().toLocaleLowerCase("tr-TR");
  // Scope wins over filter narrowing (an "overdue" page stays overdue).
  const dalParams = { ...(spec.narrow?.(view.filters) ?? {}), ...scope };

  const encoder = new TextEncoder();
  const line = (cells: unknown[]) => cells.map((c) => csvCell(c as never)).join(CSV_SEPARATOR) + "\r\n";
  let page = 1;
  let written = 0;
  let headerSent = false;

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (!headerSent) {
          headerSent = true;
          controller.enqueue(encoder.encode(CSV_BOM + line(spec.header)));
          return;
        }
        const { rows, totalPages } = await spec.fetchPage(dalParams, page);
        let chunk = "";
        for (const row of rows) {
          if (written >= EXPORT_MAX_ROWS) break;
          if (!matchesView(spec, row, view.filters, q)) continue;
          chunk += line(spec.cells(row));
          written += 1;
        }
        if (chunk) controller.enqueue(encoder.encode(chunk));
        page += 1;
        if (page > totalPages || rows.length === 0 || written >= EXPORT_MAX_ROWS) controller.close();
      } catch (err) {
        log.error("list export failed", { list, page, error: err });
        controller.error(err);
      }
    },
  });

  const fileName = `${spec.fileName}${scopeKey === "all" ? "" : `-${scopeKey}`}_${toIstanbulDay(new Date())}.csv`;
  return new NextResponse(stream, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": csvContentDisposition(fileName),
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
