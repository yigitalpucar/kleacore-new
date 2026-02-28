import { getInvoices } from "@/lib/dal/invoices";
import { parsePagination } from "@/lib/utils/pagination";
import { CancelledInvoicesContent } from "./content";

export default async function CancelledInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = parsePagination(sp);
  const result = await getInvoices({ ...params, status: "CANCELLED" });
  return <CancelledInvoicesContent data={result.data} total={result.total} />;
}
