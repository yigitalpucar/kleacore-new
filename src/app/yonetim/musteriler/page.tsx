import { getCustomers, getCustomerStats } from "@/lib/dal/customers";
import { parsePagination } from "@/lib/utils/pagination";
import { CustomersContent } from "./content";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const paginationParams = parsePagination(sp);

  const [result, stats] = await Promise.all([
    getCustomers(paginationParams),
    getCustomerStats(),
  ]);

  return <CustomersContent data={result.data} stats={stats} />;
}
