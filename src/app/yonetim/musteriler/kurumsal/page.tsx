import { getCustomers } from "@/lib/dal/customers";
import { parsePagination } from "@/lib/utils/pagination";
import { CorporateCustomersContent } from "./content";

export const dynamic = "force-dynamic";

export default async function CorporateCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const paginationParams = parsePagination(sp);

  const result = await getCustomers({
    ...paginationParams,
    customerType: "CORPORATE",
    perPage: 50,
  });

  return <CorporateCustomersContent data={result.data} total={result.total} />;
}
