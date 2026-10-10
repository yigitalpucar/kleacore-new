import type { Metadata } from "next";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { PageHeader, StatCard, StatGrid, appButton } from "@/components/app";
import { ServerPager } from "@/components/admin/server-pager";
import { getCustomers, getCustomerStats } from "@/lib/dal/customers";
import { formatTRY } from "@/lib/format/price";
import { parsePagination } from "@/lib/utils/pagination";
import { listPerPage, toCustomerRow } from "./_components/customer-row";
import { CustomersTable } from "./_components/customers-table";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { listCapabilities } from "@/lib/admin/list-views";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Müşteriler" };

const pct = (part: number, total: number) =>
  total > 0 ? `%${((part / total) * 100).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}` : "—";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("customers.view");
  const sp = await searchParams;
  const params = parsePagination(sp);

  const [result, stats] = await Promise.all([
    getCustomers({ ...params, perPage: listPerPage(sp, params.perPage) }),
    getCustomerStats(),
  ]);
  const closed = Math.max(0, stats.total - stats.active - stats.suspended);

  return (
    <>
      <PageHeader
        title="Müşteriler"
        description="Müşteri hesaplarını görüntüleyin, askıya alın veya yeniden etkinleştirin."
        actions={
          <Link href="/yonetim/musteri-ekle" prefetch={false} className={appButton()}>
            <UserPlus aria-hidden />
            Müşteri ekle
          </Link>
        }
      />

      <StatGrid columns={4}>
        <StatCard
          label="Toplam müşteri"
          value={stats.total.toLocaleString("tr-TR")}
          hint={`${stats.active.toLocaleString("tr-TR")} aktif · ${pct(stats.active, stats.total)}`}
          href="/yonetim/musteriler/tum-musteriler"
        />
        <StatCard
          label="Bireysel / kurumsal"
          value={
            <>
              {stats.individual.toLocaleString("tr-TR")}
              <span className="text-muted-foreground"> / </span>
              {stats.corporate.toLocaleString("tr-TR")}
            </>
          }
          hint={`Kurumsal oranı ${pct(stats.corporate, stats.total)}`}
          href="/yonetim/musteriler/kurumsal"
        />
        <StatCard
          label="Askıda"
          value={stats.suspended.toLocaleString("tr-TR")}
          hint={stats.suspended ? "Hesabı askıya alınmış müşteri" : "Askıda müşteri yok"}
          tone={stats.suspended ? "warning" : undefined}
          href="/yonetim/musteriler/askida"
        />
        <StatCard
          label="Toplam bakiye"
          value={formatTRY(Number(stats.totalBalance), { keepDecimals: true })}
          hint={`${closed.toLocaleString("tr-TR")} kapalı hesap`}
        />
      </StatGrid>

      <CustomersTable
        rows={result.data.map(toCustomerRow)}
        typeFilter
        capabilities={listCapabilities(session.user.role, "customers")}
        emptyAction={
          <Link href="/yonetim/musteri-ekle" prefetch={false} className={appButton({ variant: "outline", size: "sm" })}>
            <UserPlus aria-hidden />
            Müşteri ekle
          </Link>
        }
      />
      <ServerPager page={result.page} totalPages={result.totalPages} total={result.total} noun="müşteri" />
    </>
  );
}
