import type { Metadata } from "next";
import { getCustomers } from "@/lib/dal/customers";
import { parsePagination } from "@/lib/utils/pagination";
import { listPerPage, toCustomerRow } from "../_components/customer-row";
import { CustomerSegmentPage } from "../_components/segment-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Tüm müşteriler" };

export default async function AllCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = parsePagination(sp);
  const result = await getCustomers({ ...params, perPage: listPerPage(sp, params.perPage) });

  return (
    <CustomerSegmentPage
      title="Tüm müşteriler"
      description="Sistemdeki tüm müşteri hesapları."
      rows={result.data.map(toCustomerRow)}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      breakdown={true}
      statusFilter={true}
      typeFilter={true}
      emptyTitle="Henüz müşteri yok"
      emptyDescription="Yeni müşteriler kayıt oldukça burada listelenir."
    />
  );
}
