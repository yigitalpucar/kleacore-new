import type { Metadata } from "next";
import { getOrders, getOrderStats } from "@/lib/dal/orders";
import { parsePagination } from "@/lib/utils/pagination";
import { serializeOrder, withDefaultPerPage } from "../_components/serialize";
import { PendingOrdersContent } from "./content";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { listCapabilities } from "@/lib/admin/list-views";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Bekleyen siparişler" };

export default async function PendingOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("orders.view");
  const sp = await searchParams;
  const params = parsePagination(withDefaultPerPage(sp));

  const [result, stats] = await Promise.all([
    getOrders({ ...params, status: "PENDING" }),
    getOrderStats(),
  ]);

  return (
    <PendingOrdersContent
      capabilities={listCapabilities(session.user.role, "orders")}
      orders={result.data.map(serializeOrder)}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      pendingCount={stats.pending}
    />
  );
}
