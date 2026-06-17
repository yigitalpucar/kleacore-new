import { getInvoices, getInvoiceStats } from "@/lib/dal/invoices";
import { parsePagination } from "@/lib/utils/pagination";
import { AllInvoicesContent } from "./content";

export const dynamic = "force-dynamic";

export default async function AllInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = parsePagination(sp);
  const [result, stats] = await Promise.all([
    getInvoices(params),
    getInvoiceStats(),
  ]);
  return <AllInvoicesContent data={result.data} stats={stats} total={result.total} />;
}
