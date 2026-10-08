"use client";

import { FileText } from "lucide-react";
import { DataTable, EmptyState, ListRow, enumLabel, type ColumnDef } from "@/components/app";
import { formatTRY } from "@/lib/format/price";
import { formatDate } from "@/lib/format/date";

const money = (n: number) => formatTRY(n, { keepDecimals: true });

export interface TaxRow {
  month: string;
  label: string;
  subtotal: number;
  tax: number;
  total: number;
}

export interface LedgerRow {
  key: string;
  date: string;
  invoiceNumber: string;
  customerName: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: string | null;
}

const moneyCell = (value: number, strong = false) => (
  <span className={strong ? "whitespace-nowrap font-medium tabular-nums" : "whitespace-nowrap tabular-nums text-muted-foreground"}>
    {money(value)}
  </span>
);

const taxColumns: ColumnDef<TaxRow>[] = [
  { accessorKey: "month", header: "Ay", cell: ({ row }) => <span className="font-medium">{row.original.label}</span> },
  { accessorKey: "subtotal", header: "Net", meta: { align: "right" }, cell: ({ row }) => moneyCell(row.original.subtotal) },
  { accessorKey: "tax", header: "KDV", meta: { align: "right" }, cell: ({ row }) => moneyCell(row.original.tax) },
  { accessorKey: "total", header: "Toplam", meta: { align: "right" }, cell: ({ row }) => moneyCell(row.original.total, true) },
];

export function TaxBreakdownTable({ rows }: { rows: TaxRow[] }) {
  return (
    <DataTable
      caption="Aylık KDV dağılımı"
      framed={false}
      columns={taxColumns}
      data={rows}
      pageSize={0}
      initialSort={[{ id: "month", desc: true }]}
      getRowId={(r) => r.month}
      mobileCard={(r) => (
        <ListRow
          title={r.label}
          trailing={money(r.total)}
          meta={
            <>
              <span>Net {money(r.subtotal)}</span>
              <span>KDV {money(r.tax)}</span>
            </>
          }
        />
      )}
      emptyState={<EmptyState compact icon={FileText} title="Seçilen dönemde kayıt bulunamadı" />}
    />
  );
}

const ledgerColumns: ColumnDef<LedgerRow>[] = [
  {
    id: "date",
    accessorFn: (r) => r.date,
    header: "Tarih",
    cell: ({ row }) => <span className="whitespace-nowrap tabular-nums text-muted-foreground">{formatDate(row.original.date)}</span>,
  },
  {
    accessorKey: "invoiceNumber",
    header: "Fatura",
    cell: ({ row }) => (
      <div className="min-w-0 max-w-[260px]">
        <p className="font-mono text-[13px] font-medium">{row.original.invoiceNumber}</p>
        <p className="truncate text-xs text-muted-foreground">{row.original.customerName}</p>
      </div>
    ),
  },
  { accessorKey: "subtotal", header: "Net", meta: { align: "right" }, cell: ({ row }) => moneyCell(row.original.subtotal) },
  { accessorKey: "taxAmount", header: "KDV", meta: { align: "right" }, cell: ({ row }) => moneyCell(row.original.taxAmount) },
  { accessorKey: "totalAmount", header: "Toplam", meta: { align: "right" }, cell: ({ row }) => moneyCell(row.original.totalAmount, true) },
  {
    accessorKey: "paymentMethod",
    header: "Ödeme",
    enableSorting: false,
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-muted-foreground">
        {row.original.paymentMethod ? enumLabel("paymentMethod", row.original.paymentMethod) : "—"}
      </span>
    ),
  },
];

export function LedgerTable({ rows }: { rows: LedgerRow[] }) {
  return (
    <DataTable
      caption="Son defter kayıtları"
      framed={false}
      columns={ledgerColumns}
      data={rows}
      pageSize={10}
      initialSort={[{ id: "date", desc: true }]}
      getRowId={(r) => r.key}
      searchFn={(r, q) =>
        r.invoiceNumber.toLocaleLowerCase("tr-TR").includes(q) ||
        r.customerName.toLocaleLowerCase("tr-TR").includes(q)
      }
      searchPlaceholder="Fatura no veya müşteri ara…"
      mobileCard={(r) => (
        <ListRow
          title={<span className="font-mono text-[13px]">{r.invoiceNumber}</span>}
          subtitle={r.customerName}
          trailing={money(r.totalAmount)}
          meta={
            <>
              <span className="tabular-nums">{formatDate(r.date)}</span>
              <span>KDV {money(r.taxAmount)}</span>
              {r.paymentMethod ? <span>{enumLabel("paymentMethod", r.paymentMethod)}</span> : null}
            </>
          }
        />
      )}
      emptyState={<EmptyState compact icon={FileText} title="Seçilen dönemde kayıt bulunamadı" />}
    />
  );
}
