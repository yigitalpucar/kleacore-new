import Link from "next/link";
import { UserPlus } from "lucide-react";
import { PageHeader, StatCard, StatGrid, appButton } from "@/components/app";
import { ServerPager } from "@/components/admin/server-pager";
import type { CustomerRow } from "./customer-row";
import { CustomersTable } from "./customers-table";
import type { ListCapabilities } from "@/lib/admin/list-views";

/**
 * Shared body of the customer segment pages (tüm / bireysel / kurumsal /
 * askıda / kapalı): header, status breakdown, table, server pager.
 */
export function CustomerSegmentPage({
  title,
  description,
  rows,
  total,
  page,
  totalPages,
  breakdown,
  statusFilter = true,
  typeFilter = false,
  emptyTitle,
  emptyDescription,
  scope,
  capabilities,
}: {
  title: string;
  description: string;
  rows: CustomerRow[];
  total: number;
  page: number;
  totalPages: number;
  /** Show Aktif / Askıda / Kapalı counts (from the loaded rows). */
  breakdown?: boolean;
  statusFilter?: boolean;
  typeFilter?: boolean;
  emptyTitle: string;
  emptyDescription?: string;
  scope?: string;
  capabilities?: ListCapabilities;
}) {
  const count = (status: string) => rows.filter((r) => r.status === status).length;
  const partial = total > rows.length;

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          <Link href="/yonetim/musteri-ekle" prefetch={false} className={appButton({ variant: "outline" })}>
            <UserPlus aria-hidden />
            Müşteri ekle
          </Link>
        }
      />

      {breakdown ? (
        <StatGrid columns={4}>
          <StatCard label="Toplam" value={total.toLocaleString("tr-TR")} hint="Bu listedeki hesaplar" />
          <StatCard
            label="Aktif"
            value={count("ACTIVE").toLocaleString("tr-TR")}
            hint={partial ? "Bu sayfadaki kayıtlar" : "Kullanımda olan hesaplar"}
          />
          <StatCard
            label="Askıda"
            value={count("SUSPENDED").toLocaleString("tr-TR")}
            hint={count("SUSPENDED") ? "İnceleme bekliyor" : "Askıda hesap yok"}
            tone={count("SUSPENDED") ? "warning" : undefined}
          />
          <StatCard label="Kapalı" value={count("CLOSED").toLocaleString("tr-TR")} hint="Kapatılmış hesaplar" />
        </StatGrid>
      ) : null}

      <CustomersTable
        rows={rows}
        statusFilter={statusFilter}
        typeFilter={typeFilter}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
        scope={scope}
        capabilities={capabilities}
      />
      <ServerPager page={page} totalPages={totalPages} total={total} noun="müşteri" />
    </>
  );
}
