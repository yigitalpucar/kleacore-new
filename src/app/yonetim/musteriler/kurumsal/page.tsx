import type { Metadata } from "next";
import { getCustomers } from "@/lib/dal/customers";
import { parsePagination } from "@/lib/utils/pagination";
import { listPerPage, toCustomerRow } from "../_components/customer-row";
import { CustomerSegmentPage } from "../_components/segment-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Kurumsal müşteriler" };

export default async function CorporateCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = parsePagination(sp);
  const result = await getCustomers({ ...params, customerType: "CORPORATE", perPage: listPerPage(sp, params.perPage) });

  return (
    <CustomerSegmentPage
      title="Kurumsal müşteriler"
      description="Şirket veya firma adına açılmış hesaplar."
      rows={result.data.map(toCustomerRow)}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      breakdown={true}
      statusFilter={true}
      typeFilter={false}
      emptyTitle="Kurumsal müşteri yok"
      emptyDescription="Firma bilgisiyle açılan hesaplar burada görünür."
    />
  );
}
