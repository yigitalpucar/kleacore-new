import type { Metadata } from "next";
import { getCustomers } from "@/lib/dal/customers";
import { parsePagination } from "@/lib/utils/pagination";
import { listPerPage, toCustomerRow } from "../_components/customer-row";
import { CustomerSegmentPage } from "../_components/segment-page";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { listCapabilities } from "@/lib/admin/list-views";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Askıdaki müşteriler" };

export default async function SuspendedCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("customers.view");
  const sp = await searchParams;
  const params = parsePagination(sp);
  const result = await getCustomers({ ...params, status: "SUSPENDED", perPage: listPerPage(sp, params.perPage) });

  return (
    <CustomerSegmentPage
      scope="suspended"
      capabilities={listCapabilities(session.user.role, "customers")}
      title="Askıdaki müşteriler"
      description="Hesabı askıya alınmış müşteriler. Satır menüsünden yeniden etkinleştirebilirsiniz."
      rows={result.data.map(toCustomerRow)}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      breakdown={false}
      statusFilter={false}
      typeFilter={true}
      emptyTitle="Askıda müşteri yok"
      emptyDescription="Askıya alınan hesaplar burada listelenir."
    />
  );
}
