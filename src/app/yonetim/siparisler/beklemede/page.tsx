import { getOrders, getOrderStats } from "@/lib/dal/orders";
import { parsePagination } from "@/lib/utils/pagination";
import { PendingOrdersContent } from "./content";

export default async function PendingOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = parsePagination(sp);

  const [result, stats] = await Promise.all([
    getOrders({ ...params, status: "PENDING" }),
    getOrderStats(),
  ]);

  return (
    <PendingOrdersContent
      orders={result.data}
      total={result.total}
      page={result.page}
      perPage={result.perPage}
      totalPages={result.totalPages}
      pendingCount={stats.pending}
    />
  );
}
