import type { Metadata } from "next";
import Link from "next/link";
import { FilePlus } from "lucide-react";
import { PageHeader, appButton } from "@/components/app";
import { ServerPager } from "@/components/admin/server-pager";
import { getInvoices } from "@/lib/dal/invoices";
import { parsePagination } from "@/lib/utils/pagination";
import { InvoiceTable } from "../_components/invoice-table";
import { toAdminInvoiceRow, withListPageSize } from "../_components/invoice-rows";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Tüm faturalar" };

export default async function AllInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("invoices.view");
  const sp = await searchParams;
  const params = parsePagination(sp);
  const result = await getInvoices({ ...params, perPage: withListPageSize(sp, params) });
  const now = new Date();
  const rows = result.data.map((inv) => toAdminInvoiceRow(inv, now));

  return (
    <>
      <PageHeader
        title="Tüm faturalar"
        description={`Sistemdeki ${result.total.toLocaleString("tr-TR")} faturanın tamamı.`}
        actions={
          <Link href="/yonetim/faturalar/olustur" className={appButton({ variant: "outline" })}>
            <FilePlus aria-hidden />
            Fatura oluştur
          </Link>
        }
      />
      <InvoiceTable variant="all" rows={rows} pageSize={25} caption="Tüm faturalar" />
      <ServerPager page={result.page} totalPages={result.totalPages} total={result.total} noun="fatura" />
    </>
  );
}
