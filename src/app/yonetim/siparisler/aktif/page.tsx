import { getOrders, getOrderStats } from "@/lib/dal/orders";
import { parsePagination } from "@/lib/utils/pagination";
import { ActiveOrdersContent } from "./content";

export default async function ActiveOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = parsePagination(sp);

  const [result, stats] = await Promise.all([
    getOrders({ ...params, status: "PROCESSING" }),
    getOrderStats(),
  ]);

  return (
    <ActiveOrdersContent
      orders={result.data}
      total={result.total}
      page={result.page}
      perPage={result.perPage}
      totalPages={result.totalPages}
      activeCount={stats.processing}
    />
  );
}
