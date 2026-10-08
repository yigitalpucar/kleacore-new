import type { Metadata } from "next";
import { getCustomers } from "@/lib/dal/customers";
import { parsePagination } from "@/lib/utils/pagination";
import { listPerPage, toCustomerRow } from "../_components/customer-row";
import { CustomerSegmentPage } from "../_components/segment-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Askıdaki müşteriler" };

export default async function SuspendedCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = parsePagination(sp);
  const result = await getCustomers({ ...params, status: "SUSPENDED", perPage: listPerPage(sp, params.perPage) });

  return (
    <CustomerSegmentPage
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
