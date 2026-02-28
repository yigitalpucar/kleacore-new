import { getInvoices } from "@/lib/dal/invoices";
import { parsePagination } from "@/lib/utils/pagination";
import { OverdueInvoicesContent } from "./content";

export default async function OverdueInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = parsePagination(sp);
  const result = await getInvoices({ ...params, status: "OVERDUE" });
  return <OverdueInvoicesContent data={result.data} total={result.total} />;
}
