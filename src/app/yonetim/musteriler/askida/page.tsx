import { getCustomers } from "@/lib/dal/customers";
import { parsePagination } from "@/lib/utils/pagination";
import { SuspendedCustomersContent } from "./content";

export const dynamic = "force-dynamic";

export default async function SuspendedCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const paginationParams = parsePagination(sp);

  const result = await getCustomers({
    ...paginationParams,
    status: "SUSPENDED",
    perPage: 50,
  });

  return <SuspendedCustomersContent data={result.data} total={result.total} />;
}
