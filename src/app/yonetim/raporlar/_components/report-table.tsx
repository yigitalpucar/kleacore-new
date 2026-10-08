"use client";

import { FileText } from "lucide-react";
import { DataTable, EmptyState, ListRow, type ColumnDef } from "@/components/app";
import { formatTRY } from "@/lib/format/price";

/**
 * Generic report table: columns are plain data (serialisable from the server
 * page), formatting happens here. The first column is the row title on
 * phones, `trailing` the right-hand value, the rest go into the meta line.
 */
export type ReportCellKind = "text" | "mono" | "money" | "int" | "pct" | "rate";
export type ReportCell = string | number | null;

export interface ReportColumn {
  key: string;
  header: string;
  kind?: ReportCellKind;
  /** Bold (totals, the main figure). */
  strong?: boolean;
}

export type ReportRow = Record<string, ReportCell> & { id: string };

function format(value: ReportCell, kind: ReportCellKind = "text"): string {
  if (value === null || value === "") return "—";
  if (typeof value === "string") return value;
  switch (kind) {
    case "money":
      return formatTRY(value, { keepDecimals: true });
    case "pct":
      return `%${value.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}`;
    case "rate":
      return value.toLocaleString("tr-TR", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
    case "int":
      return value.toLocaleString("tr-TR");
    default:
      return String(value);
  }
}

const numeric = (kind?: ReportCellKind) => kind === "money" || kind === "int" || kind === "pct" || kind === "rate";

export function ReportTable({
  caption,
  columns,
  rows,
  trailing,
  footer,
  emptyText = "Seçilen dönemde kayıt yok.",
  pageSize = 0,
}: {
  caption: string;
  columns: ReportColumn[];
  rows: ReportRow[];
  /** Column shown on the right of the phone card. */
  trailing?: string;
  /** Totals row, rendered under the table. */
  footer?: ReportRow;
  emptyText?: string;
  pageSize?: number;
}) {
  const defs: ColumnDef<ReportRow>[] = columns.map((col) => ({
    id: col.key,
    accessorFn: (r) => r[col.key] ?? (numeric(col.kind) ? -Infinity : ""),
    header: col.header,
    enableSorting: false,
    meta: numeric(col.kind) ? { align: "right" } : undefined,
    cell: ({ row }) => (
      <span
        className={[
          "whitespace-nowrap",
          numeric(col.kind) ? "tabular-nums" : "",
          col.kind === "mono" ? "font-mono text-xs" : "",
          col.strong ? "font-medium" : numeric(col.kind) ? "text-muted-foreground" : "",
        ].join(" ")}
      >
        {format(row.original[col.key], col.kind)}
      </span>
    ),
  }));

  const [titleCol, ...rest] = columns;
  const trailingCol = columns.find((c) => c.key === trailing);
  const metaCols = rest.filter((c) => c.key !== trailing);

  return (
    <div>
      <DataTable
        caption={caption}
        framed={false}
        columns={defs}
        data={rows}
        pageSize={pageSize}
        getRowId={(r) => r.id}
        mobileCard={(r) => (
          <ListRow
            title={format(r[titleCol.key], titleCol.kind)}
            trailing={trailingCol ? format(r[trailingCol.key], trailingCol.kind) : undefined}
            meta={metaCols.slice(0, 4).map((c) => (
              <span key={c.key}>
                {c.header}: {format(r[c.key], c.kind)}
              </span>
            ))}
          />
        )}
        emptyState={<EmptyState compact icon={FileText} title={emptyText} />}
      />
      {footer && rows.length > 0 ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 border-t bg-muted/40 px-4 py-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
          {columns.slice(1).map((c) =>
            footer[c.key] === undefined || footer[c.key] === null ? null : (
              <div key={c.key} className="flex justify-between gap-2 sm:block">
                <dt className="text-xs text-muted-foreground">{c.header}</dt>
                <dd className="font-medium tabular-nums">{format(footer[c.key], c.kind)}</dd>
              </div>
            )
          )}
        </dl>
      ) : null}
    </div>
  );
}
