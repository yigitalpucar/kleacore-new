import type { Metadata } from "next";
import { getSuspendedOrders } from "@/lib/dal/order-views";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { parsePagination } from "@/lib/utils/pagination";
import { serializeOrder, withDefaultPerPage } from "../_components/serialize";
import { SuspendedOrdersContent } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Askıdaki siparişler" };

export default async function SuspendedOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("orders.view");

  const sp = await searchParams;
  const params = parsePagination(withDefaultPerPage(sp));

  const result = await getSuspendedOrders(params);

  return (
    <SuspendedOrdersContent
      orders={result.data.map(serializeOrder)}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
    />
  );
}
