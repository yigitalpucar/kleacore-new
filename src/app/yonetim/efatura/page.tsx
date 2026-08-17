import { getEInvoiceRecordsForAdmin, getEInvoiceStats } from "@/lib/dal/e-invoices";
import type { EInvoiceStatus } from "@prisma/client";
import { EfaturaContent } from "./content";

export const dynamic = "force-dynamic";

function readStatusFilter(
  searchParams: Record<string, string | string[] | undefined>
): EInvoiceStatus | "all" {
  const value = searchParams.status;
  const status = typeof value === "string" ? value : undefined;

  if (!status || status === "all") {
    return "all";
  }

  const allowed: EInvoiceStatus[] = [
    "DRAFT",
    "QUEUED",
    "SENT",
    "ACCEPTED",
    "REJECTED",
    "FAILED",
  ];

  if (allowed.includes(status as EInvoiceStatus)) {
    return status as EInvoiceStatus;
  }

  return "all";
}

export default async function EfaturaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const statusFilter = readStatusFilter(sp);

  const [records, stats] = await Promise.all([
    getEInvoiceRecordsForAdmin(statusFilter),
    getEInvoiceStats(),
  ]);

  return (
    <EfaturaContent
      records={records}
      stats={stats}
      statusFilter={typeof sp.status === "string" ? sp.status : "all"}
    />
  );
}