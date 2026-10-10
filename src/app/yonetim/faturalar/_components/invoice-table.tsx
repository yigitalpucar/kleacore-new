"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle, Download, Eye, FileText, Mail, Receipt, User } from "lucide-react";
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
import { bulkCancelInvoices, bulkSendInvoiceReminders } from "@/lib/actions/admin/bulk";
import { useAdminList, type BulkActionDef } from "@/components/admin/list-tools/use-admin-list";
import type { ListCapabilities } from "@/lib/admin/list-views";
import { formatDate } from "@/lib/format/date";
import { formatTRY } from "@/lib/format/price";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { INVOICE_FILTER_VALUES, invoiceSearch, type AdminInvoiceRow } from "./invoice-rows";

export type InvoiceTableVariant = "all" | "pending" | "overdue" | "paid" | "cancelled";

const money = (n: number) => formatTRY(n, { keepDecimals: true });
const detailHref = (id: string) => `/yonetim/faturalar/${id}`;
const pdfHref = (id: string) => `/api/faturalar/${id}/pdf`;
const isOpen = (status: string) => status === "PENDING" || status === "OVERDUE";

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

const FILTERS: Record<InvoiceTableVariant, DataTableFilter<AdminInvoiceRow>[]> = {
  all: [
    {
      id: "status",
      label: "Durum",
      options: getStatusOptions("invoice").filter((o) => o.value !== "DRAFT"),
      getValue: INVOICE_FILTER_VALUES.status,
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
      getValue: INVOICE_FILTER_VALUES.urgency,
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
      getValue: INVOICE_FILTER_VALUES.severity,
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

/* -------------------------------------------------------------- bulk */

const n = (v: number) => v.toLocaleString("tr-TR");

const BULK_ACTIONS: BulkActionDef<AdminInvoiceRow>[] = [
  {
    id: "remind",
    label: "Hatırlatma gönder",
    icon: <Mail aria-hidden />,
    appliesTo: (inv) => isOpen(inv.status),
    confirmTitle: (c) => `${n(c)} faturaya hatırlatma gönderilsin mi?`,
    confirmDescription: "Her müşteriye vadesine göre ödeme hatırlatması ya da gecikme e-postası gider.",
    confirmLabel: "Gönder",
    run: (ids) => bulkSendInvoiceReminders(ids),
    successText: (c) => `${n(c)} faturaya hatırlatma gönderildi`,
  },
  {
    id: "cancel",
    label: "İptal et",
    icon: <Ban aria-hidden />,
    destructive: true,
    appliesTo: (inv) => inv.status !== "PAID" && inv.status !== "CANCELLED",
    confirmTitle: (c) => `${n(c)} fatura iptal edilsin mi?`,
    confirmDescription: "Ödenmiş faturalar iptal edilemez. İptal edilen fatura için müşteriden ödeme alınmaz.",
    run: (ids) => bulkCancelInvoices(ids),
    successText: (c) => `${n(c)} fatura iptal edildi`,
  },
];

const getId = (inv: AdminInvoiceRow) => inv.id;
const getLabel = (inv: AdminInvoiceRow) => inv.invoiceNumber;

/* -------------------------------------------------------------- table */

export function InvoiceTable({
  variant,
  rows,
  pageSize = 10,
  caption = "Faturalar",
  capabilities,
}: {
  variant: InvoiceTableVariant;
  rows: AdminInvoiceRow[];
  pageSize?: number;
  caption?: string;
  /** Bulk actions / CSV export allowed for the viewer (from the server). */
  capabilities?: ListCapabilities;
}) {
  const router = useRouter();
  const admin = useAdminList({
    list: "invoices",
    scope: variant,
    filterIds: FILTERS[variant].map((f) => f.id),
    getId,
    getLabel,
    noun: "fatura",
    actions: BULK_ACTIONS,
    capabilities,
  });

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
      searchFn={invoiceSearch}
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
      {...admin.tableProps}
      toolbar={admin.toolbar}
    />
  );
}
