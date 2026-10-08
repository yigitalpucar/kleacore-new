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

export const metadata: Metadata = { title: "Bekleyen faturalar" };

export default async function PendingInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = parsePagination(sp);
  const result = await getInvoices({ ...params, perPage: withListPageSize(sp, params), status: "PENDING" });
  const now = new Date();
  const rows = result.data.map((inv) => toAdminInvoiceRow(inv, now));
  const sum = toNumber(sumMoney(rows.map((r) => r.totalAmount)));

  return (
    <>
      <PageHeader title="Bekleyen faturalar" description="Ödemesi beklenen, vadesi henüz gelmemiş faturalar." />
      <StatGrid columns={3}>
        <StatCard label="Bekleyen fatura" value={result.total.toLocaleString("tr-TR")} />
        <StatCard label="Bekleyen tutar" value={formatTRY(sum, { keepDecimals: true })} hint={result.totalPages > 1 ? "Bu sayfadaki faturalar" : undefined} />
        <StatCard
          label="Kritik (0–2 gün)"
          value={rows.filter((r) => r.daysToDue <= 2).length.toLocaleString("tr-TR")}
          tone={rows.some((r) => r.daysToDue <= 2) ? "warning" : undefined}
          hint="Son ödemeye 2 gün veya daha az kaldı"
        />
      </StatGrid>
      <InvoiceTable variant="pending" rows={rows} pageSize={25} caption="Bekleyen faturalar" />
      <ServerPager page={result.page} totalPages={result.totalPages} total={result.total} noun="fatura" />
    </>
  );
}
