import { getSuspendedOrders } from "@/lib/dal/order-views";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import { parsePagination } from "@/lib/utils/pagination";
import { SuspendedOrdersContent } from "./content";

export default async function SuspendedOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const sp = await searchParams;
  const params = parsePagination(sp);

  const result = await getSuspendedOrders(params);

  return (
    <SuspendedOrdersContent
      orders={result.data}
      total={result.total}
      page={result.page}
      perPage={result.perPage}
      totalPages={result.totalPages}
    />
  );
}
