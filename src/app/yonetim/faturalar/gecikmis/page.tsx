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

export const metadata: Metadata = { title: "Gecikmiş faturalar" };

export default async function OverdueInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("invoices.view");
  const sp = await searchParams;
  const params = parsePagination(sp);
  const now = new Date();
  // Same set as the dashboard card: OVERDUE plus PENDING past the due date.
  const result = await getInvoices({ ...params, perPage: withListPageSize(sp, params), pastDueAt: now });
  const rows = result.data.map((inv) => toAdminInvoiceRow(inv, now));
  const sum = toNumber(sumMoney(rows.map((r) => r.totalAmount)));

  return (
    <>
      <PageHeader title="Gecikmiş faturalar" description="Son ödeme tarihi geçmiş, ödenmemiş faturalar (gecikmiş olarak işaretlenenler ve vadesi yeni geçenler). Hatırlatma gönderin ya da ödemeyi işaretleyin." />
      <StatGrid columns={3}>
        <StatCard
          label="Gecikmiş fatura"
          value={result.total.toLocaleString("tr-TR")}
          tone={result.total ? "danger" : undefined}
          hint={result.total ? "Ödeme bekleniyor" : "Gecikmiş fatura yok"}
        />
        <StatCard label="Gecikmiş tutar" value={formatTRY(sum, { keepDecimals: true })} hint={result.totalPages > 1 ? "Bu sayfadaki faturalar" : undefined} />
        <StatCard
          label="Ortalama gecikme"
          value={`${rows.length ? Math.round(rows.reduce((s, r) => s + Math.max(0, -r.daysToDue), 0) / rows.length) : 0} gün`}
          hint={`30+ gün: ${rows.filter((r) => -r.daysToDue >= 30).length} fatura`}
        />
      </StatGrid>
      <InvoiceTable variant="overdue" rows={rows} capabilities={listCapabilities(session.user.role, "invoices")} pageSize={25} caption="Gecikmiş faturalar" />
      <ServerPager page={result.page} totalPages={result.totalPages} total={result.total} noun="fatura" />
    </>
  );
}
