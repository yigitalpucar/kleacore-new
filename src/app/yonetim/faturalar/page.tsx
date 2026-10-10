import type { Metadata } from "next";
import Link from "next/link";
import { FilePlus } from "lucide-react";
import { PageHeader, StatCard, StatGrid, appButton } from "@/components/app";
import { ServerPager } from "@/components/admin/server-pager";
import { getInvoices, getInvoiceStats } from "@/lib/dal/invoices";
import { formatTRY } from "@/lib/format/price";
import { parsePagination } from "@/lib/utils/pagination";
import { InvoiceTable } from "./_components/invoice-table";
import { toAdminInvoiceRow, withListPageSize } from "./_components/invoice-rows";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { listCapabilities } from "@/lib/admin/list-views";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Faturalar" };

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("invoices.view");
  const sp = await searchParams;
  const params = parsePagination(sp);
  const [result, stats] = await Promise.all([
    getInvoices({ ...params, perPage: withListPageSize(sp, params) }),
    getInvoiceStats(),
  ]);
  const now = new Date();
  const rows = result.data.map((inv) => toAdminInvoiceRow(inv, now));

  return (
    <>
      <PageHeader
        title="Faturalar"
        description="Tüm faturaları izleyin, ödemeleri işaretleyin ve hatırlatma gönderin."
        actions={
          <Link href="/yonetim/faturalar/olustur" className={appButton()}>
            <FilePlus aria-hidden />
            Fatura oluştur
          </Link>
        }
      />

      <StatGrid columns={4}>
        <StatCard
          label="Tahsil edilen"
          value={formatTRY(stats.paidAmount, { keepDecimals: true })}
          hint="Ödenmiş faturaların toplamı"
        />
        <StatCard label="Ödenen" value={stats.paid.toLocaleString("tr-TR")} hint={`${stats.total.toLocaleString("tr-TR")} faturadan`} href="/yonetim/faturalar/odendi" />
        <StatCard
          label="Bekleyen"
          value={stats.pending.toLocaleString("tr-TR")}
          hint="Vadesi gelmemiş"
          tone={stats.pending ? "warning" : undefined}
          href="/yonetim/faturalar/bekleyen"
        />
        <StatCard
          label="Gecikmiş"
          value={stats.overdue.toLocaleString("tr-TR")}
          hint={stats.overdue ? "Son ödeme tarihi geçti" : "Gecikmiş fatura yok"}
          tone={stats.overdue ? "danger" : undefined}
          href="/yonetim/faturalar/gecikmis"
        />
      </StatGrid>

      <InvoiceTable variant="all" rows={rows} capabilities={listCapabilities(session.user.role, "invoices")} />
      <ServerPager page={result.page} totalPages={result.totalPages} total={result.total} noun="fatura" />
    </>
  );
}
