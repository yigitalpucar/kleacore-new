import type { Metadata } from "next";
import { getCustomers } from "@/lib/dal/customers";
import { parsePagination } from "@/lib/utils/pagination";
import { listPerPage, toCustomerRow } from "../_components/customer-row";
import { CustomerSegmentPage } from "../_components/segment-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Bireysel müşteriler" };

export default async function IndividualCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = parsePagination(sp);
  const result = await getCustomers({ ...params, customerType: "INDIVIDUAL", perPage: listPerPage(sp, params.perPage) });

  return (
    <CustomerSegmentPage
      title="Bireysel müşteriler"
      description="Şahıs adına açılmış müşteri hesapları."
      rows={result.data.map(toCustomerRow)}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      breakdown={true}
      statusFilter={true}
      typeFilter={false}
      emptyTitle="Bireysel müşteri yok"
      emptyDescription="Bireysel hesap açıldığında burada görünür."
    />
  );
}
