import { getCustomers } from "@/lib/dal/customers";
import { parsePagination } from "@/lib/utils/pagination";
import { ClosedCustomersContent } from "./content";

export default async function ClosedCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const paginationParams = parsePagination(sp);

  const result = await getCustomers({
    ...paginationParams,
    status: "CLOSED",
    perPage: 50,
  });

  return <ClosedCustomersContent data={result.data} total={result.total} />;
}
