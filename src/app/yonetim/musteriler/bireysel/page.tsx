import { getCustomers } from "@/lib/dal/customers";
import { parsePagination } from "@/lib/utils/pagination";
import { IndividualCustomersContent } from "./content";

export const dynamic = "force-dynamic";

export default async function IndividualCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const paginationParams = parsePagination(sp);

  const result = await getCustomers({
    ...paginationParams,
    customerType: "INDIVIDUAL",
    perPage: 50,
  });

  return <IndividualCustomersContent data={result.data} total={result.total} />;
}
