import { getCustomers, getCustomerStats } from "@/lib/dal/customers";
import { parsePagination } from "@/lib/utils/pagination";
import { AllCustomersContent } from "./content";

export default async function AllCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const paginationParams = parsePagination(sp);

  const [result, stats] = await Promise.all([
    getCustomers({ ...paginationParams, perPage: 50 }),
    getCustomerStats(),
  ]);

  return <AllCustomersContent data={result.data} stats={stats} />;
}
