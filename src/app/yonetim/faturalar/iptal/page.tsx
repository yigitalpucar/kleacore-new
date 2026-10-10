import type { Metadata } from "next";
import { PageHeader, StatCard, StatGrid } from "@/components/app";
import { ServerPager } from "@/components/admin/server-pager";
import { getInvoices } from "@/lib/dal/invoices";
import { formatTRY } from "@/lib/format/price";
import { parsePagination } from "@/lib/utils/pagination";
import { InvoiceTable } from "../_components/invoice-table";
import { toAdminInvoiceRow, withListPageSize } from "../_components/invoice-rows";
import { sum as sumMoney, toNumber } from "@/lib/money";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { listCapabilities } from "@/lib/admin/list-views";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "İptal edilen faturalar" };

export default async function CancelledInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("invoices.view");
  const sp = await searchParams;
  const params = parsePagination(sp);
  const result = await getInvoices({ ...params, perPage: withListPageSize(sp, params), status: "CANCELLED" });
  const now = new Date();
  const rows = result.data.map((inv) => toAdminInvoiceRow(inv, now));
  const sum = toNumber(sumMoney(rows.map((r) => r.totalAmount)));

  return (
    <>
      <PageHeader title="İptal edilen faturalar" description="İptal edilmiş faturaların listesi." />
      <StatGrid columns={2}>
        <StatCard label="İptal edilen fatura" value={result.total.toLocaleString("tr-TR")} />
        <StatCard label="İptal edilen tutar" value={formatTRY(sum, { keepDecimals: true })} hint={result.totalPages > 1 ? "Bu sayfadaki faturalar" : undefined} />
      </StatGrid>
      <InvoiceTable variant="cancelled" rows={rows} capabilities={listCapabilities(session.user.role, "invoices")} pageSize={25} caption="İptal edilen faturalar" />
      <ServerPager page={result.page} totalPages={result.totalPages} total={result.total} noun="fatura" />
    </>
  );
}
