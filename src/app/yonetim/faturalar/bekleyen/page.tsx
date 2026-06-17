import { getInvoices } from "@/lib/dal/invoices";
import { parsePagination } from "@/lib/utils/pagination";
import { PendingInvoicesContent } from "./content";

export const dynamic = "force-dynamic";

export default async function PendingInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = parsePagination(sp);
  const result = await getInvoices({ ...params, status: "PENDING" });
  return <PendingInvoicesContent data={result.data} total={result.total} />;
}
