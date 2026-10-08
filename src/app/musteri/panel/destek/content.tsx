"use client";

import Link from "next/link";
import { Headphones, MessageSquare, Plus } from "lucide-react";
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
} from "@/components/app";
import { formatDate, formatDateTime } from "@/lib/format/date";

interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  department: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

interface DestekListContentProps {
  tickets: Ticket[];
}

const P = "/musteri/panel/destek";

function Priority({ value }: { value: string }) {
  const meta = getStatusMeta("ticketPriority", value);
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <ToneDot tone={meta.tone} />
      {meta.label}
    </span>
  );
}

const columns: ColumnDef<Ticket>[] = [
  {
    accessorKey: "subject",
    header: "Konu",
    cell: ({ row }) => {
      const t = row.original;
      return (
        <div className="min-w-0 max-w-[420px]">
          <Link href={`${P}/${t.id}`} className="block truncate font-medium hover:underline">
            {t.subject}
          </Link>
          <p className="text-xs text-muted-foreground">
            <span className="font-mono">#{t.ticketNumber}</span> · {formatDate(t.createdAt)} tarihinde açıldı
          </p>
        </div>
      );
    },
  },
  {
    accessorKey: "department",
    header: "Departman",
    cell: ({ row }) => <span className="text-muted-foreground">{enumLabel("ticketDepartment", row.original.department)}</span>,
  },
  {
    accessorKey: "priority",
    header: "Öncelik",
    sortingFn: (a, b) =>
      ["LOW", "MEDIUM", "HIGH", "URGENT"].indexOf(a.original.priority) -
      ["LOW", "MEDIUM", "HIGH", "URGENT"].indexOf(b.original.priority),
    cell: ({ row }) => <Priority value={row.original.priority} />,
  },
  {
    accessorKey: "messageCount",
    header: "Mesaj",
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className="inline-flex items-center gap-1 tabular-nums text-muted-foreground">
        <MessageSquare aria-hidden className="size-3.5" />
        {row.original.messageCount}
      </span>
    ),
  },
  {
    id: "updatedAt",
    accessorFn: (t) => t.updatedAt,
    header: "Son güncelleme",
    cell: ({ row }) => <span className="whitespace-nowrap tabular-nums text-muted-foreground">{formatDateTime(row.original.updatedAt)}</span>,
  },
  {
    accessorKey: "status",
    header: "Durum",
    enableSorting: false,
    cell: ({ row }) => <StatusBadge kind="ticket" status={row.original.status} />,
  },
];

export function DestekListContent({ tickets }: DestekListContentProps) {
  const stats = {
    total: tickets.length,
    open: tickets.filter((t) => t.status === "OPEN").length,
    answered: tickets.filter((t) => t.status === "ADMIN_REPLY").length,
    waiting: tickets.filter((t) => t.status === "CUSTOMER_REPLY" || t.status === "WAITING").length,
  };

  return (
    <>
      <PageHeader
        title="Destek talepleri"
        description="Destek taleplerinizi takip edin, yanıtları görüntüleyin."
        actions={
          <Link href={`${P}/yeni`} className={appButton()}>
            <Plus aria-hidden />
            Yeni talep
          </Link>
        }
      />

      <StatGrid>
        <StatCard label="Toplam" value={stats.total} hint="Tüm talepleriniz" />
        <StatCard label="Açık" value={stats.open} tone={stats.open ? "info" : undefined} hint="İnceleme bekleyen" />
        <StatCard
          label="Yanıtlandı"
          value={stats.answered}
          tone={stats.answered ? "success" : undefined}
          hint={stats.answered ? "Yanıtınızı bekliyor" : "Yeni yanıt yok"}
        />
        <StatCard label="Beklemede" value={stats.waiting} tone={stats.waiting ? "warning" : undefined} hint="Ekibimizin yanıtı bekleniyor" />
      </StatGrid>

      <DataTable
        caption="Destek talepleri"
        columns={columns}
        data={tickets}
        initialSort={[{ id: "updatedAt", desc: true }]}
        searchFn={(t, q) =>
          t.ticketNumber.toLocaleLowerCase("tr-TR").includes(q) || t.subject.toLocaleLowerCase("tr-TR").includes(q)
        }
        searchPlaceholder="Talep no veya konu ara…"
        filters={[{ id: "status", label: "Durum", options: getStatusOptions("ticket"), getValue: (t) => t.status }]}
        rowHref={(t) => `${P}/${t.id}`}
        mobileCard={(t) => (
          <ListRow
            title={t.subject}
            subtitle={
              <>
                <span className="font-mono">#{t.ticketNumber}</span> · {enumLabel("ticketDepartment", t.department)}
              </>
            }
            trailing={<StatusBadge kind="ticket" status={t.status} />}
            meta={
              <>
                <Priority value={t.priority} />
                <span>{formatDateTime(t.updatedAt)}</span>
                <span className="inline-flex items-center gap-1">
                  <MessageSquare aria-hidden className="size-3" />
                  {t.messageCount}
                </span>
              </>
            }
          />
        )}
        emptyState={
          <EmptyState
            icon={Headphones}
            title="Henüz destek talebiniz yok"
            description="Bir sorun yaşarsanız ya da sorunuz varsa destek ekibimize yazabilirsiniz."
            action={
              <Link href={`${P}/yeni`} className={appButton()}>
                Yeni talep oluştur
              </Link>
            }
          />
        }
        noResultsText="Aramanızla eşleşen talep bulunamadı."
      />
    </>
  );
}
