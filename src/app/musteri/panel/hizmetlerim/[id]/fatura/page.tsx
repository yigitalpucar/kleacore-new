import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CreditCard, Download } from "lucide-react";
import { auth } from "@/lib/auth";
import { getServiceById } from "@/lib/dal/services";
import { getInvoicesByCustomer } from "@/lib/dal/invoices";
import {
  AppBreadcrumbLabel,
  PageHeader,
  SectionCard,
  StatCard,
  StatGrid,
  StatusBadge,
  appButton,
} from "@/components/app";
import { formatTRY } from "@/lib/format/price";
import { formatDate } from "@/lib/format/date";
import { sub, sum, toNumber } from "@/lib/money";
import { PanelEmptyState } from "@/components/panel/panel-empty-state";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Hizmet faturaları" };

interface Props {
  params: Promise<{ id: string }>;
}

const money = (n: number) => formatTRY(n, { keepDecimals: true });

export default async function ServiceInvoicesPage(props: Props) {
  const params = await props.params;
  const session = await auth();
  const userId = session!.user.id;

  const service = await getServiceById(params.id);

  if (!service || service.customerId !== userId) {
    notFound();
  }

  // Get all customer invoices — DB does not have a direct service-invoice relation,
  // so we fetch all and show them in context of this service
  const invoices = await getInvoicesByCustomer(userId);

  const totalPaid = toNumber(
    sum(invoices.filter((inv) => inv.status === "PAID").map((inv) => inv.paidAmount))
  );

  const pendingAmount = toNumber(
    sum(
      invoices
        .filter((inv) => inv.status === "PENDING" || inv.status === "OVERDUE")
        .map((inv) => sub(inv.totalAmount, inv.paidAmount))
    )
  );

  return (
    <>
      <AppBreadcrumbLabel segment={params.id} label={service.product.name} />

      <PageHeader
        back={{ href: `/musteri/panel/hizmetlerim/${params.id}`, label: service.product.name }}
        title="Fatura geçmişi"
        description={`${service.product.name} · ${service.domain || service.label || "—"}`}
        actions={
          <Link href="/musteri/panel/faturalar" className={appButton({ variant: "outline" })}>
            Tüm faturalar
          </Link>
        }
      />

      <StatGrid columns={3} className="grid-cols-1 sm:grid-cols-3">
        <StatCard label="Toplam fatura" value={invoices.length} />
        <StatCard label="Toplam ödenen" value={money(totalPaid)} />
        <StatCard
          label="Bekleyen"
          value={money(pendingAmount)}
          tone={pendingAmount > 0 ? "warning" : undefined}
          hint={pendingAmount > 0 ? "Ödenmemiş faturalar" : "Bekleyen ödeme yok"}
        />
      </StatGrid>

      <SectionCard
        title="Faturalar"
        description="Faturalar hizmet bazında ayrılmadığı için hesabınızdaki tüm faturalar listelenir."
        flush
      >
        {invoices.length ? (
          <ul className="divide-y">
            {invoices.map((invoice) => {
              const payable = invoice.status === "PENDING" || invoice.status === "OVERDUE";
              return (
                <li key={invoice.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center md:px-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/musteri/panel/faturalar/${invoice.id}`}
                        className="font-mono text-[13px] font-medium hover:underline"
                      >
                        {invoice.invoiceNumber}
                      </Link>
                      <StatusBadge kind="invoice" status={invoice.status} />
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {invoice.items[0]?.description ?? "—"} · Düzenlenme {formatDate(invoice.issuedAt)}
                      {invoice.status === "PAID" && invoice.paidAt
                        ? ` · Ödendi ${formatDate(invoice.paidAt)}`
                        : payable
                          ? ` · Son ödeme ${formatDate(invoice.dueDate)}`
                          : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="mr-auto whitespace-nowrap text-sm font-medium tabular-nums sm:mr-2">
                      {money(Number(invoice.totalAmount))}
                    </span>
                    {payable ? (
                      <Link href={`/musteri/panel/faturalar/${invoice.id}`} className={appButton({ size: "sm" })}>
                        <CreditCard aria-hidden />
                        Öde
                      </Link>
                    ) : null}
                    <Link
                      href={`/musteri/panel/faturalar/${invoice.id}`}
                      className={appButton({ variant: "outline", size: "sm" })}
                    >
                      Detay
                    </Link>
                    <a
                      href={`/api/faturalar/${invoice.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${invoice.invoiceNumber} PDF indir`}
                      className={appButton({ variant: "ghost", size: "icon-sm" })}
                    >
                      <Download aria-hidden />
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <PanelEmptyState kind="invoices" compact className="m-4" />
        )}
      </SectionCard>
    </>
  );
}
