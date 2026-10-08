import { Download } from "lucide-react";
import { appButton } from "@/components/app";
import type { ReportTableKey } from "@/lib/reports/tables";

/** Plain download link (works without JS); the route sets the file name. */
export function CsvLink({ table, query }: { table: ReportTableKey; query: string }) {
  return (
    <a
      href={`/api/admin/reports/csv?table=${table}&${query}`}
      className={appButton({ variant: "outline", size: "sm" })}
      download
      aria-label="CSV olarak indir"
    >
      <Download aria-hidden />
      CSV
    </a>
  );
}
