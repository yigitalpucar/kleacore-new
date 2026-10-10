"use client";

import Link from "next/link";
import { CreditCard, Download, Eye } from "lucide-react";
import {
  DataTable,
  ListRow,
  PageHeader,
  StatCard,
  StatGrid,
  StatusBadge,
  appButton,
  getStatusMeta,
  getStatusOptions,
  type ColumnDef,
} from "@/components/app";
import { getCustomerEInvoiceLabel } from "@/lib/efatura/customer-status";
import { formatTRY } from "@/lib/format/price";
import { formatDate } from "@/lib/format/date";
import type { EInvoiceStatus } from "@prisma/client";
import { PanelEmptyState } from "@/components/panel/panel-empty-state";

interface SerializedInvoice {
  id: string;
  invoiceNumber: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  dueDate: string;
  paidAt: string | null;
  createdAt: string;
  items: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
  eInvoice: {
    status: string;
    type: string;
    sentAt: string | null;
  } | null;
}

interface FaturalarContentProps {
  invoices: SerializedInvoice[];
  stats: {
    outstanding: number;
    pending: number;
    overdue: number;
  };
}

const money = (n: number) => formatTRY(n, { keepDecimals: true });
const detailHref = (id: string) => `/musteri/panel/faturalar/${id}`;
const pdfHref = (id: string) => `/api/faturalar/${id}/pdf`;
const canPay = (status: string) => status === "PENDING" || status === "OVERDUE";

function EInvoiceBadge({ eInvoice }: { eInvoice: SerializedInvoice["eInvoice"] }) {
  if (!eInvoice) return null;
  return (
    <StatusBadge
      tone={getStatusMeta("eInvoice", eInvoice.status).tone}
      label={getCustomerEInvoiceLabel(eInvoice.status as EInvoiceStatus, eInvoice.type as "e-fatura" | "e-arsiv")}
    />
  );
}

const columns: ColumnDef<SerializedInvoice>[] = [
  {
    accessorKey: "invoiceNumber",
    header: "Fatura",
    cell: ({ row }) => {
      const inv = row.original;
      return (
        <div className="min-w-0 max-w-[340px]">
          <Link href={detailHref(inv.id)} className="font-mono text-[13px] font-medium hover:underline">
            {inv.invoiceNumber}
          </Link>
          <p className="truncate text-xs text-muted-foreground">{inv.items[0]?.description ?? "—"}</p>
        </div>
      );
    },
  },
  {
    id: "createdAt",
    accessorFn: (r) => r.createdAt,
    header: "Tarih",
    cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
  },
  {
    id: "dueDate",
    accessorFn: (r) => r.dueDate,
    header: "Son ödeme",
    cell: ({ row }) => {
      const inv = row.original;
      return inv.status === "PAID" && inv.paidAt ? (
        <span className="text-muted-foreground">
          <span className="tabular-nums">{formatDate(inv.paidAt)}</span>
          <span className="block text-xs">ödendi</span>
        </span>
      ) : (
        <span className="tabular-nums">{formatDate(inv.dueDate)}</span>
      );
    },
  },
  {
    accessorKey: "totalAmount",
    header: "Tutar",
    meta: { align: "right" },
    cell: ({ row }) => <span className="whitespace-nowrap font-medium tabular-nums">{money(row.original.totalAmount)}</span>,
  },
  {
    accessorKey: "status",
    header: "Durum",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="flex flex-wrap gap-1.5">
        <StatusBadge kind="invoice" status={row.original.status} />
        {row.original.status === "PAID" ? <EInvoiceBadge eInvoice={row.original.eInvoice} /> : null}
      </div>
    ),
  },
  {
    id: "pay",
    header: () => <span className="sr-only">Ödeme</span>,
    enableSorting: false,
    meta: { align: "right", className: "w-px" },
    cell: ({ row }) =>
      canPay(row.original.status) ? (
        <Link href={detailHref(row.original.id)} className={appButton({ size: "sm" })}>
          <CreditCard aria-hidden />
          Öde
        </Link>
      ) : null,
  },
];

export function FaturalarContent({ invoices, stats }: FaturalarContentProps) {
  const unpaidCount = invoices.filter((i) => canPay(i.status)).length;
  const overdueCount = invoices.filter((i) => i.status === "OVERDUE").length;

  return (
    <>
      <PageHeader
        title="Faturalarım"
        description="Faturalarınızı görüntüleyin, PDF olarak indirin ve ödemelerinizi yapın."
      />

      <StatGrid columns={3} className="grid-cols-1 sm:grid-cols-3">
        <StatCard
          label="Ödenmemiş toplam"
          value={money(stats.outstanding)}
          hint={unpaidCount ? `${unpaidCount} fatura` : "Ödenmemiş fatura yok"}
          tone={unpaidCount ? "warning" : undefined}
        />
        <StatCard label="Bekleyen" value={money(stats.pending)} hint="Vadesi gelmemiş faturalar" />
        <StatCard
          label="Gecikmiş"
          value={money(stats.overdue)}
          hint={overdueCount ? `${overdueCount} faturanın vadesi geçti` : "Gecikmiş fatura yok"}
          tone={overdueCount ? "danger" : undefined}
        />
      </StatGrid>

      <DataTable
        caption="Faturalar"
        columns={columns}
        data={invoices}
        initialSort={[{ id: "createdAt", desc: true }]}
        searchFn={(inv, q) =>
          inv.invoiceNumber.toLocaleLowerCase("tr-TR").includes(q) ||
          (inv.items[0]?.description ?? "").toLocaleLowerCase("tr-TR").includes(q)
        }
        searchPlaceholder="Fatura no veya açıklama ara…"
        filters={[
          {
            id: "status",
            label: "Durum",
            options: getStatusOptions("invoice").filter((o) => o.value !== "DRAFT"),
            getValue: (inv) => inv.status,
          },
        ]}
        rowHref={(inv) => detailHref(inv.id)}
        rowActions={(inv) => [
          { label: "Görüntüle", href: detailHref(inv.id), icon: <Eye aria-hidden /> },
          ...(canPay(inv.status) ? [{ label: "Öde", href: detailHref(inv.id), icon: <CreditCard aria-hidden /> }] : []),
          {
            label: "PDF indir",
            icon: <Download aria-hidden />,
            onSelect: () => window.open(pdfHref(inv.id), "_blank", "noopener,noreferrer"),
          },
        ]}
        mobileCard={(inv) => (
          <ListRow
            title={<span className="font-mono text-[13px]">{inv.invoiceNumber}</span>}
            subtitle={inv.items[0]?.description}
            trailing={money(inv.totalAmount)}
            meta={
              <>
                <StatusBadge kind="invoice" status={inv.status} />
                <span>
                  {inv.status === "PAID" && inv.paidAt ? `Ödendi ${formatDate(inv.paidAt)}` : `Son ödeme ${formatDate(inv.dueDate)}`}
                </span>
              </>
            }
          />
        )}
        emptyState={
          <PanelEmptyState kind="invoices" />
        }
        noResultsText="Aramanızla eşleşen fatura bulunamadı."
      />
    </>
  );
}
