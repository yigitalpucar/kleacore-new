"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle, Download, Eye, FileText, Mail, Receipt, User } from "lucide-react";
import {
  DataTable,
  EmptyState,
  ListRow,
  StatusBadge,
  getStatusOptions,
  type ColumnDef,
  type DataTableFilter,
  type RowAction,
} from "@/components/app";
import { markPaid, sendInvoiceReceipt, sendInvoiceReminder } from "@/lib/actions/admin/invoices";
import { formatDate } from "@/lib/format/date";
import { formatTRY } from "@/lib/format/price";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { AdminInvoiceRow } from "./invoice-rows";

export type InvoiceTableVariant = "all" | "pending" | "overdue" | "paid" | "cancelled";

const money = (n: number) => formatTRY(n, { keepDecimals: true });
const detailHref = (id: string) => `/yonetim/faturalar/${id}`;
const pdfHref = (id: string) => `/api/faturalar/${id}/pdf`;
const isOpen = (status: string) => status === "PENDING" || status === "OVERDUE";
const lower = (s: string) => s.toLocaleLowerCase("tr-TR");

/* ------------------------------------------------------------ columns */

const invoiceColumn: ColumnDef<AdminInvoiceRow> = {
  accessorKey: "invoiceNumber",
  header: "Fatura",
  cell: ({ row }) => {
    const inv = row.original;
    return (
      <div className="min-w-0 max-w-[280px]">
        <Link href={detailHref(inv.id)} className="font-mono text-[13px] font-medium hover:underline">
          {inv.invoiceNumber}
        </Link>
        <p className="truncate text-xs text-muted-foreground">{inv.description ?? "—"}</p>
      </div>
    );
  },
};

const customerColumn: ColumnDef<AdminInvoiceRow> = {
  id: "customer",
  accessorFn: (r) => r.customer.name,
  header: "Müşteri",
  cell: ({ row }) => {
    const c = row.original.customer;
    return (
      <div className="min-w-0 max-w-[240px]">
        <Link href={`/yonetim/musteriler/${c.id}`} className="font-medium hover:underline">
          {c.name}
        </Link>
        <p className="truncate text-xs text-muted-foreground">{c.email}</p>
      </div>
    );
  },
};

const dateColumn = (id: "createdAt" | "dueDate" | "paidAt" | "updatedAt", header: string): ColumnDef<AdminInvoiceRow> => ({
  id,
  accessorFn: (r) => r[id] ?? "",
  header,
  cell: ({ row }) => (
    <span className="whitespace-nowrap tabular-nums text-muted-foreground">{formatDate(row.original[id])}</span>
  ),
});

const amountColumn: ColumnDef<AdminInvoiceRow> = {
  accessorKey: "totalAmount",
  header: "Tutar",
  meta: { align: "right" },
  cell: ({ row }) => (
    <span
      className={cn(
        "whitespace-nowrap font-medium tabular-nums",
        row.original.status === "CANCELLED" && "text-muted-foreground line-through"
      )}
    >
      {money(row.original.totalAmount)}
    </span>
  ),
};

const statusColumn: ColumnDef<AdminInvoiceRow> = {
  accessorKey: "status",
  header: "Durum",
  enableSorting: false,
  cell: ({ row }) => <StatusBadge kind="invoice" status={row.original.status} />,
};

function dueLabel(days: number) {
  if (days > 0) return `${days} gün kaldı`;
  if (days === 0) return "Bugün";
  return `${Math.abs(days)} gün gecikti`;
}

const remainingColumn: ColumnDef<AdminInvoiceRow> = {
  id: "remaining",
  accessorFn: (r) => r.daysToDue,
  header: "Kalan süre",
  cell: ({ row }) => {
    const d = row.original.daysToDue;
    return (
      <span className={cn("whitespace-nowrap tabular-nums", d <= 2 ? "font-medium text-foreground" : "text-muted-foreground")}>
        {dueLabel(d)}
      </span>
    );
  },
};

const overdueColumn: ColumnDef<AdminInvoiceRow> = {
  id: "overdue",
  accessorFn: (r) => -r.daysToDue,
  header: "Gecikme",
  cell: ({ row }) => {
    const d = Math.max(0, -row.original.daysToDue);
    return (
      <span className={cn("whitespace-nowrap tabular-nums", d >= 30 ? "font-medium text-foreground" : "text-muted-foreground")}>
        {d} gün
      </span>
    );
  },
};

const COLUMNS: Record<InvoiceTableVariant, ColumnDef<AdminInvoiceRow>[]> = {
  all: [invoiceColumn, customerColumn, dateColumn("createdAt", "Oluşturma"), dateColumn("dueDate", "Son ödeme"), amountColumn, statusColumn],
  pending: [invoiceColumn, customerColumn, dateColumn("dueDate", "Son ödeme"), remainingColumn, amountColumn],
  overdue: [invoiceColumn, customerColumn, dateColumn("dueDate", "Son ödeme"), overdueColumn, amountColumn],
  paid: [invoiceColumn, customerColumn, dateColumn("createdAt", "Oluşturma"), dateColumn("paidAt", "Ödeme tarihi"), amountColumn],
  cancelled: [invoiceColumn, customerColumn, dateColumn("createdAt", "Oluşturma"), dateColumn("updatedAt", "İptal tarihi"), amountColumn],
};

const INITIAL_SORT: Record<InvoiceTableVariant, { id: string; desc: boolean }[]> = {
  all: [{ id: "createdAt", desc: true }],
  pending: [{ id: "remaining", desc: false }],
  overdue: [{ id: "overdue", desc: true }],
  paid: [{ id: "paidAt", desc: true }],
  cancelled: [{ id: "updatedAt", desc: true }],
};

/* ------------------------------------------------------------ filters */

function urgency(r: AdminInvoiceRow) {
  if (r.daysToDue <= 2) return "critical";
  if (r.daysToDue <= 5) return "warning";
  return "normal";
}

function severity(r: AdminInvoiceRow) {
  const d = -r.daysToDue;
  if (d >= 30) return "severe";
  if (d >= 15) return "moderate";
  return "mild";
}

const FILTERS: Record<InvoiceTableVariant, DataTableFilter<AdminInvoiceRow>[]> = {
  all: [
    {
      id: "status",
      label: "Durum",
      options: getStatusOptions("invoice").filter((o) => o.value !== "DRAFT"),
      getValue: (r) => r.status,
    },
  ],
  pending: [
    {
      id: "urgency",
      label: "Aciliyet",
      options: [
        { value: "critical", label: "Kritik (0–2 gün)" },
        { value: "warning", label: "Yaklaşan (3–5 gün)" },
        { value: "normal", label: "Normal (6+ gün)" },
      ],
      getValue: urgency,
    },
  ],
  overdue: [
    {
      id: "severity",
      label: "Gecikme",
      options: [
        { value: "mild", label: "1–14 gün" },
        { value: "moderate", label: "15–29 gün" },
        { value: "severe", label: "30+ gün" },
      ],
      getValue: severity,
    },
  ],
  paid: [],
  cancelled: [],
};

const EMPTY: Record<InvoiceTableVariant, { title: string; description: string }> = {
  all: { title: "Henüz fatura yok", description: "Siparişlerden ya da elle oluşturulan faturalar burada listelenir." },
  pending: { title: "Bekleyen fatura yok", description: "Ödemesi beklenen bir fatura bulunmuyor." },
  overdue: { title: "Gecikmiş fatura yok", description: "Son ödeme tarihi geçmiş fatura bulunmuyor." },
  paid: { title: "Ödenmiş fatura yok", description: "Ödemesi tamamlanan faturalar burada listelenir." },
  cancelled: { title: "İptal edilmiş fatura yok", description: "İptal edilen faturalar burada listelenir." },
};

/* -------------------------------------------------------------- table */

export function InvoiceTable({
  variant,
  rows,
  pageSize = 10,
  caption = "Faturalar",
}: {
  variant: InvoiceTableVariant;
  rows: AdminInvoiceRow[];
  pageSize?: number;
  caption?: string;
}) {
  const router = useRouter();

  const handleMarkPaid = async (id: string) => {
    const result = await markPaid(id);
    if (!result.success) {
      toast.error(result.error ?? "Fatura durumu güncellenemedi");
      return;
    }
    toast.success("Fatura ödendi olarak işaretlendi");
    router.refresh();
  };

  const handleSendReminder = async (id: string) => {
    const result = await sendInvoiceReminder(id);
    if (!result.success) {
      toast.error(result.error ?? "Hatırlatma gönderilemedi");
      return;
    }
    toast.success(result.message ?? "Hatırlatma gönderildi");
  };

  const handleSendReceipt = async (id: string) => {
    const result = await sendInvoiceReceipt(id);
    if (!result.success) {
      toast.error(result.error ?? "Makbuz gönderilemedi");
      return;
    }
    toast.success(result.message ?? "Makbuz gönderildi");
  };

  const rowActions = (inv: AdminInvoiceRow): RowAction[] => [
    { label: "Detayları gör", href: detailHref(inv.id), icon: <Eye aria-hidden /> },
    { label: "Müşteriyi gör", href: `/yonetim/musteriler/${inv.customer.id}`, icon: <User aria-hidden /> },
    {
      label: "PDF indir",
      icon: <Download aria-hidden />,
      onSelect: () => window.open(pdfHref(inv.id), "_blank", "noopener,noreferrer"),
    },
    ...(isOpen(inv.status)
      ? [
          { label: "Hatırlatma gönder", icon: <Mail aria-hidden />, onSelect: () => void handleSendReminder(inv.id) },
          {
            label: "Ödendi olarak işaretle",
            icon: <CheckCircle aria-hidden />,
            onSelect: () => void handleMarkPaid(inv.id),
            separator: true,
          },
        ]
      : []),
    ...(inv.status === "PAID"
      ? [{ label: "Makbuz gönder", icon: <Receipt aria-hidden />, onSelect: () => void handleSendReceipt(inv.id) }]
      : []),
  ];

  const metaLine = (inv: AdminInvoiceRow) => {
    switch (variant) {
      case "pending":
        return `Son ödeme ${formatDate(inv.dueDate)} · ${dueLabel(inv.daysToDue)}`;
      case "overdue":
        return `${Math.max(0, -inv.daysToDue)} gün gecikti`;
      case "paid":
        return `Ödendi ${formatDate(inv.paidAt)}`;
      case "cancelled":
        return `İptal ${formatDate(inv.updatedAt)}`;
      default:
        return inv.status === "PAID" && inv.paidAt ? `Ödendi ${formatDate(inv.paidAt)}` : `Son ödeme ${formatDate(inv.dueDate)}`;
    }
  };

  return (
    <DataTable
      caption={caption}
      columns={COLUMNS[variant]}
      data={rows}
      pageSize={pageSize}
      initialSort={INITIAL_SORT[variant]}
      searchFn={(inv, q) =>
        lower(inv.invoiceNumber).includes(q) ||
        lower(inv.customer.name).includes(q) ||
        lower(inv.customer.email).includes(q) ||
        lower(inv.description ?? "").includes(q)
      }
      searchPlaceholder="Fatura no, müşteri veya e-posta ara…"
      filters={FILTERS[variant]}
      rowHref={(inv) => detailHref(inv.id)}
      rowActions={rowActions}
      mobileCard={(inv) => (
        <ListRow
          title={<span className="font-mono text-[13px]">{inv.invoiceNumber}</span>}
          subtitle={inv.customer.name}
          trailing={money(inv.totalAmount)}
          meta={
            <>
              {variant === "all" ? <StatusBadge kind="invoice" status={inv.status} /> : null}
              <span>{metaLine(inv)}</span>
            </>
          }
        />
      )}
      emptyState={<EmptyState icon={FileText} title={EMPTY[variant].title} description={EMPTY[variant].description} />}
      noResultsText="Aramanızla eşleşen fatura bulunamadı."
    />
  );
}
