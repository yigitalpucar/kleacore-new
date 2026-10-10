"use client";

import Link from "next/link";
import { CheckCircle, Clock, Eye, FilePlus, Mail, Pause, Users, XCircle } from "lucide-react";
import {
  DataTable,
  EmptyState,
  ListRow,
  StatusBadge,
  enumLabel,
  getStatusOptions,
  type ColumnDef,
  type DataTableFilter,
  type RowAction,
} from "@/components/app";
import { formatDate } from "@/lib/format/date";
import { useCustomerActions } from "../use-customer-actions";
import { bulkActivateCustomers, bulkSuspendCustomers } from "@/lib/actions/admin/bulk";
import { useAdminList, type BulkActionDef } from "@/components/admin/list-tools/use-admin-list";
import type { ListCapabilities } from "@/lib/admin/list-views";
import { CUSTOMER_FILTER_VALUES, customerSearch, type CustomerRow } from "./customer-row";

const detailHref = (id: string) => `/yonetim/musteriler/${id}`;
const fullName = (c: CustomerRow) => `${c.name} ${c.surname}`.trim();

const columns: ColumnDef<CustomerRow>[] = [
  {
    id: "name",
    accessorFn: (c) => fullName(c),
    header: "Müşteri",
    cell: ({ row }) => {
      const c = row.original;
      return (
        <div className="min-w-0 max-w-[260px]">
          <Link href={detailHref(c.id)} className="font-medium hover:underline">
            {fullName(c) || "—"}
          </Link>
          <p className="truncate text-xs text-muted-foreground">{c.companyName ?? c.email}</p>
        </div>
      );
    },
  },
  {
    accessorKey: "email",
    header: "İletişim",
    cell: ({ row }) => (
      <div className="min-w-0 max-w-[240px]">
        <p className="truncate">{row.original.email}</p>
        <p className="text-xs tabular-nums text-muted-foreground">{row.original.phone || "Telefon yok"}</p>
      </div>
    ),
  },
  {
    id: "type",
    accessorFn: (c) => c.customerType ?? "INDIVIDUAL",
    header: "Tip",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{enumLabel("customerType", row.original.customerType ?? "INDIVIDUAL")}</span>
    ),
  },
  {
    accessorKey: "services",
    header: "Hizmet",
    meta: { align: "right" },
    cell: ({ row }) => <span className="tabular-nums">{row.original.services}</span>,
  },
  {
    id: "createdAt",
    accessorFn: (c) => c.createdAt,
    header: "Kayıt",
    cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{formatDate(row.original.createdAt)}</span>,
  },
  {
    accessorKey: "status",
    header: "Durum",
    enableSorting: false,
    cell: ({ row }) => <StatusBadge kind="user" status={row.original.status} />,
  },
];

const n = (v: number) => v.toLocaleString("tr-TR");

const BULK_ACTIONS: BulkActionDef<CustomerRow>[] = [
  {
    id: "suspend",
    label: "Askıya al",
    icon: <Pause aria-hidden />,
    appliesTo: (c) => c.status === "ACTIVE",
    confirmTitle: (c) => `${n(c)} müşteri hesabı askıya alınsın mı?`,
    confirmDescription: "Askıdaki müşteri panele giriş yapamaz. Hizmetleri bu işlemle askıya alınmaz.",
    run: (ids) => bulkSuspendCustomers(ids),
    successText: (c) => `${n(c)} müşteri askıya alındı`,
  },
  {
    id: "activate",
    label: "Aktif et",
    icon: <CheckCircle aria-hidden />,
    appliesTo: (c) => c.status === "SUSPENDED" || c.status === "CLOSED",
    confirmTitle: (c) => `${n(c)} müşteri hesabı aktif edilsin mi?`,
    run: (ids) => bulkActivateCustomers(ids),
    successText: (c) => `${n(c)} müşteri aktif edildi`,
  },
];

const getId = (c: CustomerRow) => c.id;
const getLabel = (c: CustomerRow) => fullName(c) || c.email;

export function CustomersTable({
  rows,
  statusFilter = true,
  typeFilter = false,
  emptyTitle = "Henüz müşteri yok",
  emptyDescription,
  emptyAction,
  scope = "all",
  capabilities,
}: {
  rows: CustomerRow[];
  /** Export scope of the segment page (individual, corporate, suspended, closed). */
  scope?: string;
  /** Bulk actions / CSV export allowed for the viewer (from the server). */
  capabilities?: ListCapabilities;
  /** Show the Durum filter tabs (off on lists that are already one status). */
  statusFilter?: boolean;
  /** Show the Tip filter (bireysel / kurumsal). */
  typeFilter?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
}) {
  const { handleSuspendCustomer, handleActivateCustomer, handleCloseCustomer } = useCustomerActions();
  const admin = useAdminList({
    list: "customers",
    scope,
    filterIds: [...(statusFilter ? ["status"] : []), ...(typeFilter ? ["type"] : [])],
    getId,
    getLabel,
    noun: "müşteri",
    actions: BULK_ACTIONS,
    capabilities,
  });

  const filters: DataTableFilter<CustomerRow>[] = [];
  if (statusFilter) {
    filters.push({ id: "status", label: "Durum", options: getStatusOptions("user"), getValue: CUSTOMER_FILTER_VALUES.status });
  }
  if (typeFilter) {
    filters.push({
      id: "type",
      label: "Tip",
      variant: "select",
      allLabel: "Tüm tipler",
      options: [
        { value: "INDIVIDUAL", label: "Bireysel" },
        { value: "CORPORATE", label: "Kurumsal" },
      ],
      getValue: CUSTOMER_FILTER_VALUES.type,
    });
  }

  const rowActions = (c: CustomerRow): RowAction[] => [
    { label: "Detayları görüntüle", href: detailHref(c.id), icon: <Eye aria-hidden /> },
    { label: "E-posta gönder", href: `mailto:${c.email}`, icon: <Mail aria-hidden /> },
    { label: "Fatura oluştur", href: "/yonetim/faturalar/olustur", icon: <FilePlus aria-hidden /> },
    { label: "Aktivite geçmişi", href: `${detailHref(c.id)}#aktivite`, icon: <Clock aria-hidden />, separator: true },
    ...(c.status === "ACTIVE"
      ? [{ label: "Hesabı askıya al", icon: <Pause aria-hidden />, onSelect: () => void handleSuspendCustomer(c.id) }]
      : []),
    ...(c.status === "SUSPENDED" || c.status === "CLOSED"
      ? [{ label: "Hesabı aktif et", icon: <CheckCircle aria-hidden />, onSelect: () => void handleActivateCustomer(c.id) }]
      : []),
    ...(c.status !== "CLOSED"
      ? [{ label: "Hesabı kapat", icon: <XCircle aria-hidden />, destructive: true, onSelect: () => void handleCloseCustomer(c.id) }]
      : []),
  ];

  return (
    <DataTable
      caption="Müşteriler"
      columns={columns}
      data={rows}
      initialSort={[{ id: "createdAt", desc: true }]}
      searchFn={customerSearch}
      searchPlaceholder="İsim, firma veya e-posta ara…"
      filters={filters}
      rowHref={(c) => detailHref(c.id)}
      rowActions={rowActions}
      mobileCard={(c) => (
        <ListRow
          title={fullName(c) || c.email}
          subtitle={c.companyName ?? c.email}
          trailing={<span className="text-xs font-normal text-muted-foreground">{c.services} hizmet</span>}
          meta={
            <>
              <StatusBadge kind="user" status={c.status} />
              <span>{enumLabel("customerType", c.customerType ?? "INDIVIDUAL")}</span>
              <span>Kayıt {formatDate(c.createdAt)}</span>
            </>
          }
        />
      )}
      emptyState={<EmptyState icon={Users} title={emptyTitle} description={emptyDescription} action={emptyAction} />}
      noResultsText="Aramanızla eşleşen müşteri bulunamadı."
      {...admin.tableProps}
      toolbar={admin.toolbar}
    />
  );
}
