import type { Metadata } from "next";
import { PageHeader, StatCard, StatGrid } from "@/components/app";
import { ServerPager } from "@/components/admin/server-pager";
import { getInvoices } from "@/lib/dal/invoices";
import { formatTRY } from "@/lib/format/price";
import { parsePagination } from "@/lib/utils/pagination";
import { InvoiceTable } from "../_components/invoice-table";
import { toAdminInvoiceRow, withListPageSize } from "../_components/invoice-rows";
import { sum as sumMoney, toNumber } from "@/lib/money";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Ödenen faturalar" };

export default async function PaidInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = parsePagination(sp);
  const result = await getInvoices({ ...params, perPage: withListPageSize(sp, params), status: "PAID" });
  const now = new Date();
  const rows = result.data.map((inv) => toAdminInvoiceRow(inv, now));
  const sum = toNumber(sumMoney(rows.map((r) => r.totalAmount)));

  return (
    <>
      <PageHeader title="Ödenen faturalar" description="Ödemesi tamamlanmış faturalar." />
      <StatGrid columns={2}>
        <StatCard label="Ödenen fatura" value={result.total.toLocaleString("tr-TR")} />
        <StatCard label="Tahsil edilen" value={formatTRY(sum, { keepDecimals: true })} hint={result.totalPages > 1 ? "Bu sayfadaki faturalar" : undefined} />
      </StatGrid>
      <InvoiceTable variant="paid" rows={rows} pageSize={25} caption="Ödenen faturalar" />
      <ServerPager page={result.page} totalPages={result.totalPages} total={result.total} noun="fatura" />
    </>
  );
}
