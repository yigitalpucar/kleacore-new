import type { Metadata } from "next";
import { getCustomers } from "@/lib/dal/customers";
import { parsePagination } from "@/lib/utils/pagination";
import { listPerPage, toCustomerRow } from "../_components/customer-row";
import { CustomerSegmentPage } from "../_components/segment-page";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Kapalı hesaplar" };

export default async function ClosedCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("customers.view");
  const sp = await searchParams;
  const params = parsePagination(sp);
  const result = await getCustomers({ ...params, status: "CLOSED", perPage: listPerPage(sp, params.perPage) });

  return (
    <CustomerSegmentPage
      title="Kapalı hesaplar"
      description="Kapatılmış müşteri hesapları. Gerekirse yeniden etkinleştirebilirsiniz."
      rows={result.data.map(toCustomerRow)}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      breakdown={false}
      statusFilter={false}
      typeFilter={true}
      emptyTitle="Kapalı hesap yok"
      emptyDescription="Kapatılan hesaplar burada listelenir."
    />
  );
}
