import { getOrders, getOrderStats } from "@/lib/dal/orders";
import { parsePagination } from "@/lib/utils/pagination";
import { CancelledOrdersContent } from "./content";

export const dynamic = "force-dynamic";

export default async function CancelledOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = parsePagination(sp);

  const [result, stats] = await Promise.all([
    getOrders({ ...params, status: "CANCELLED" }),
    getOrderStats(),
  ]);

  return (
    <CancelledOrdersContent
      orders={result.data}
      total={result.total}
      page={result.page}
      perPage={result.perPage}
      totalPages={result.totalPages}
      cancelledCount={stats.cancelled}
    />
  );
}
