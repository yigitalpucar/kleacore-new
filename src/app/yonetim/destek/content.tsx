"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle, Eye, Headphones, Mail, MessageSquareText, RotateCcw, Settings, User, UserCheck, X } from "lucide-react";
import {
  DataTable,
  EmptyState,
  ListRow,
  PageHeader,
  StatCard,
  StatGrid,
  StatusBadge,
  ToneDot,
  appButton,
  enumLabel,
  getStatusMeta,
  getStatusOptions,
  type ColumnDef,
  type RowAction,
} from "@/components/app";
import { ServerPager } from "@/components/admin/server-pager";
import { closeTicket, reopenTicket } from "@/lib/actions/admin/tickets";
import { bulkAssignTickets, bulkCloseTickets } from "@/lib/actions/admin/bulk";
import { useAdminList, type BulkActionDef } from "@/components/admin/list-tools/use-admin-list";
import type { ListCapabilities } from "@/lib/admin/list-views";
import { formatDateTime } from "@/lib/format/date";
import { toast } from "@/lib/toast";
import { TICKET_FILTER_VALUES, ticketSearch, type AdminTicketRow } from "./ticket-rows";

export type { AdminTicketRow } from "./ticket-rows";

interface DestekContentProps {
  data: AdminTicketRow[];
  total: number;
  page: number;
  totalPages: number;
  /** Filters applied on the server from ?status / ?priority / ?department. */
  serverFilters: { status?: string; priority?: string; department?: string };
  /** Header links shown only to staff who may open them (tickets.reply / settings.manage). */
  links?: { cannedReplies: boolean; settings: boolean };
  /** Bulk actions / CSV export allowed for the viewer (from the server). */
  capabilities?: ListCapabilities;
  /** Active staff for bulk assignment. */
  staff?: { id: string; name: string }[];
}

const getId = (t: AdminTicketRow) => t.id;
const getLabel = (t: AdminTicketRow) => `#${t.ticketNumber}`;

const detailHref = (id: string) => `/yonetim/destek/${id}`;
const PRIORITY_RANK: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

function PriorityLabel({ priority }: { priority: string }) {
  const meta = getStatusMeta("ticketPriority", priority);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]">
      <ToneDot tone={meta.tone} />
      {meta.label}
    </span>
  );
}

const columns: ColumnDef<AdminTicketRow>[] = [
  {
    accessorKey: "subject",
    header: "Talep",
    cell: ({ row }) => {
      const t = row.original;
      return (
        <div className="min-w-0 max-w-[340px]">
          <Link href={detailHref(t.id)} className="line-clamp-1 font-medium hover:underline">
            {t.subject}
          </Link>
          <p className="truncate text-xs text-muted-foreground">
            <span className="font-mono">#{t.ticketNumber}</span> · {enumLabel("ticketDepartment", t.department)} ·{" "}
            {t.messageCount} mesaj
            {t.source === "EMAIL" ? (
              <>
                {" · "}
                <Mail aria-label="E-posta ile açıldı" className="inline size-3 align-[-2px]" />
              </>
            ) : null}
          </p>
        </div>
      );
    },
  },
  {
    id: "customer",
    accessorFn: (r) => r.customer.name,
    header: "Müşteri",
    cell: ({ row }) => {
      const c = row.original.customer;
      return (
        <div className="min-w-0 max-w-[220px]">
          {c.id ? (
            <Link href={`/yonetim/musteriler/${c.id}`} className="font-medium hover:underline">
              {c.name}
            </Link>
          ) : (
            <span className="font-medium">
              {c.name}
              <span className="ml-1.5 rounded border border-dashed px-1 py-0.5 font-mono text-[10px] font-normal uppercase tracking-wider text-muted-foreground">
                Kayıtsız
              </span>
            </span>
          )}
          <p className="truncate text-xs text-muted-foreground">{c.email}</p>
        </div>
      );
    },
  },
  {
    id: "priority",
    accessorFn: (r) => PRIORITY_RANK[r.priority] ?? 0,
    header: "Öncelik",
    cell: ({ row }) => <PriorityLabel priority={row.original.priority} />,
  },
  {
    accessorKey: "status",
    header: "Durum",
    enableSorting: false,
    cell: ({ row }) => <StatusBadge kind="ticket" audience="admin" status={row.original.status} />,
  },
  {
    id: "updatedAt",
    accessorFn: (r) => r.updatedAt,
    header: "Son hareket",
    cell: ({ row }) => (
      <span className="whitespace-nowrap tabular-nums text-muted-foreground">{formatDateTime(row.original.updatedAt)}</span>
    ),
  },
];

export function DestekContent({
  data,
  total,
  page,
  totalPages,
  serverFilters,
  links = { cannedReplies: true, settings: true },
  capabilities,
  staff = [],
}: DestekContentProps) {
  const router = useRouter();
  const n = (v: number) => v.toLocaleString("tr-TR");
  const bulkActions: BulkActionDef<AdminTicketRow>[] = [
    {
      id: "assign",
      label: "Ata",
      icon: <UserCheck aria-hidden />,
      appliesTo: (t) => t.status !== "CLOSED",
      confirmTitle: (c) => `${n(c)} talep personele atansın mı?`,
      confirmDescription: "Kapalı talepler atlanır. Atanan personel talebin sorumlusu olur.",
      input: { kind: "select", label: "Atanacak personel", options: staff.map((s) => ({ value: s.id, label: s.name })) },
      run: (ids, staffId) => bulkAssignTickets(ids, staffId),
      successText: (c) => `${n(c)} talep atandı`,
    },
    {
      id: "close",
      label: "Kapat",
      icon: <CheckCircle aria-hidden />,
      appliesTo: (t) => t.status !== "CLOSED",
      confirmTitle: (c) => `${n(c)} talep kapatılsın mı?`,
      confirmDescription: "Müşterilere talebin kapandığı bildirilir. Kapalı talepler yeniden açılabilir.",
      run: (ids) => bulkCloseTickets(ids),
      successText: (c) => `${n(c)} talep kapatıldı`,
    },
  ];
  const admin = useAdminList({
    list: "tickets",
    filterIds: ["status", "priority", "department"],
    filterDefaults: {
      status: serverFilters.status ?? "all",
      priority: serverFilters.priority ?? "all",
      department: serverFilters.department ?? "all",
    },
    getId,
    getLabel,
    noun: "talep",
    actions: bulkActions,
    capabilities,
  });

  const handleCloseTicket = async (ticketId: string) => {
    const result = await closeTicket(ticketId);
    if (!result.success) {
      toast.error(result.error ?? "Talep kapatılamadı");
      return;
    }
    toast.success("Talep kapatıldı");
    router.refresh();
  };

  const handleReopenTicket = async (ticketId: string) => {
    const result = await reopenTicket(ticketId);
    if (!result.success) {
      toast.error(result.error ?? "Talep yeniden açılamadı");
      return;
    }
    toast.success("Talep yeniden açıldı");
    router.refresh();
  };

  const awaitingUs = data.filter((t) => t.status === "OPEN" || t.status === "CUSTOMER_REPLY").length;
  const awaitingCustomer = data.filter((t) => t.status === "ADMIN_REPLY" || t.status === "WAITING").length;
  const urgent = data.filter((t) => t.status !== "CLOSED" && (t.priority === "URGENT" || t.priority === "HIGH")).length;
  const closed = data.filter((t) => t.status === "CLOSED").length;
  const partial = totalPages > 1;

  const activeServerFilters = [
    serverFilters.status ? `Durum: ${getStatusMeta("ticket", serverFilters.status, "admin").label}` : null,
    serverFilters.priority ? `Öncelik: ${getStatusMeta("ticketPriority", serverFilters.priority).label}` : null,
    serverFilters.department ? `Departman: ${enumLabel("ticketDepartment", serverFilters.department)}` : null,
  ].filter(Boolean);

  const rowActions = (t: AdminTicketRow): RowAction[] => [
    { label: "Talebi aç", href: detailHref(t.id), icon: <Eye aria-hidden /> },
    t.customer.id
      ? { label: "Müşteriyi gör", href: `/yonetim/musteriler/${t.customer.id}`, icon: <User aria-hidden /> }
      : { label: "Müşteriyi gör", icon: <User aria-hidden />, disabledReason: "Kayıtlı müşteri değil" },
    t.status === "CLOSED"
      ? { label: "Yeniden aç", icon: <RotateCcw aria-hidden />, onSelect: () => void handleReopenTicket(t.id), separator: true }
      : { label: "Talebi kapat", icon: <CheckCircle aria-hidden />, onSelect: () => void handleCloseTicket(t.id), separator: true },
  ];

  return (
    <>
      <PageHeader
        title="Destek talepleri"
        description="Müşteri taleplerini yanıtlayın, personele atayın ve kapatın."
        actions={
          <>
            {links.cannedReplies && (
              <Link href="/yonetim/destek/hazir-yanitlar" className={appButton({ variant: "outline" })}>
                <MessageSquareText aria-hidden />
                Hazır yanıtlar
              </Link>
            )}
            {links.settings && (
              <Link href="/yonetim/destek/ayarlar" className={appButton({ variant: "outline" })}>
                <Settings aria-hidden />
                Ayarlar
              </Link>
            )}
          </>
        }
      />

      <StatGrid columns={4}>
        <StatCard
          label="Yanıt bekleyen"
          value={awaitingUs.toLocaleString("tr-TR")}
          hint="Açık veya müşteri yanıtladı"
          tone={awaitingUs ? "warning" : undefined}
        />
        <StatCard
          label="Acil / yüksek"
          value={urgent.toLocaleString("tr-TR")}
          hint="Açık talepler arasında"
          tone={urgent ? "danger" : undefined}
        />
        <StatCard label="Müşteri bekleniyor" value={awaitingCustomer.toLocaleString("tr-TR")} hint="Yanıtlandı veya beklemede" />
        <StatCard
          label="Toplam"
          value={total.toLocaleString("tr-TR")}
          hint={partial ? `Bu sayfada ${closed} kapalı` : `${closed} kapalı talep`}
        />
      </StatGrid>

      {activeServerFilters.length ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm">
          <span className="text-muted-foreground">Bağlantı filtresi:</span>
          {activeServerFilters.map((f) => (
            <span key={f} className="rounded border bg-background px-2 py-0.5 text-[13px]">
              {f}
            </span>
          ))}
          <Link href="/yonetim/destek" className={appButton({ variant: "ghost", size: "sm", className: "ml-auto" })}>
            <X aria-hidden />
            Filtreyi kaldır
          </Link>
        </div>
      ) : null}

      <DataTable
        caption="Destek talepleri"
        columns={columns}
        data={data}
        pageSize={15}
        initialSort={[{ id: "updatedAt", desc: true }]}
        searchFn={ticketSearch}
        searchPlaceholder="Konu, talep no veya müşteri ara…"
        filters={[
          {
            id: "status",
            label: "Durum",
            options: getStatusOptions("ticket", "admin"),
            getValue: TICKET_FILTER_VALUES.status,
            defaultValue: serverFilters.status ?? "all",
          },
          {
            id: "priority",
            label: "Öncelik",
            variant: "select",
            options: getStatusOptions("ticketPriority"),
            getValue: TICKET_FILTER_VALUES.priority,
            defaultValue: serverFilters.priority ?? "all",
          },
          {
            id: "department",
            label: "Departman",
            variant: "select",
            options: ["GENERAL", "TECHNICAL", "BILLING", "SALES"].map((d) => ({
              value: d,
              label: enumLabel("ticketDepartment", d),
            })),
            getValue: TICKET_FILTER_VALUES.department,
            defaultValue: serverFilters.department ?? "all",
          },
        ]}
        rowHref={(t) => detailHref(t.id)}
        rowActions={rowActions}
        mobileCard={(t) => (
          <ListRow
            title={t.subject}
            subtitle={`${t.customer.name} · #${t.ticketNumber}`}
            meta={
              <>
                <StatusBadge kind="ticket" audience="admin" status={t.status} />
                <PriorityLabel priority={t.priority} />
                <span>{formatDateTime(t.updatedAt)}</span>
              </>
            }
          />
        )}
        emptyState={
          <EmptyState
            icon={Headphones}
            title={activeServerFilters.length ? "Bu filtreyle talep yok" : "Henüz destek talebi yok"}
            description="Müşterilerin açtığı talepler burada listelenir."
            action={
              activeServerFilters.length ? (
                <Link href="/yonetim/destek" className={appButton({ variant: "outline", size: "sm" })}>
                  Tüm talepleri göster
                </Link>
              ) : undefined
            }
          />
        }
        noResultsText="Aramanızla eşleşen talep bulunamadı."
        {...admin.tableProps}
        toolbar={admin.toolbar}
      />
      <ServerPager page={page} totalPages={totalPages} total={total} noun="talep" />
    </>
  );
}
