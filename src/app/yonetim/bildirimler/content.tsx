"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Eye, LayoutTemplate, Lock, Mail, MessageSquare, X } from "lucide-react";
import {
  DataTable,
  EmptyState,
  FormField,
  ListRow,
  PageHeader,
  SectionCard,
  StatCard,
  StatGrid,
  StatusBadge,
  appButton,
  getStatusOptions,
  type ColumnDef,
} from "@/components/app";
import { ServerPager } from "@/components/admin/server-pager";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format/date";
import { ResendButton } from "./resend-button";

export interface NotificationRow {
  id: string;
  template: string;
  templateLabel: string;
  channel: "EMAIL" | "SMS";
  to: string;
  subject: string;
  status: string;
  error: string | null;
  attempts: number;
  redacted: boolean;
  isResend: boolean;
  createdAt: string;
  sentAt: string | null;
  customer: { id: string; name: string } | null;
}

interface Props {
  rows: NotificationRow[];
  total: number;
  page: number;
  totalPages: number;
  stats: { sent24h: number; failed24h: number; skipped24h: number; queued: number };
  templates: Array<{ key: string; label: string }>;
  filters: { status: string; channel: string; template: string; search: string };
}

const selectClass =
  "h-11 w-full rounded-md border bg-background px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-9";

const SKIP_REASONS: Record<string, string> = {
  SMTP_NOT_CONFIGURED: "SMTP yapılandırılmamış",
  EMAIL_NOTIFICATIONS_DISABLED: "E-posta bildirimleri kapalı",
  SMS_PROVIDER_DISABLED: "SMS sağlayıcısı kapalı",
};

function ChannelIcon({ channel }: { channel: NotificationRow["channel"] }) {
  return channel === "SMS" ? (
    <MessageSquare aria-label="SMS" className="size-3.5 shrink-0 text-muted-foreground" />
  ) : (
    <Mail aria-label="E-posta" className="size-3.5 shrink-0 text-muted-foreground" />
  );
}

function StatusCell({ row }: { row: NotificationRow }) {
  const reason = row.error ? (SKIP_REASONS[row.error] ?? row.error) : null;
  return (
    <div className="min-w-0 space-y-1">
      <StatusBadge kind="notification" status={row.status} />
      {reason && row.status !== "SENT" ? (
        <p className="max-w-[220px] truncate text-xs text-muted-foreground" title={reason}>
          {reason}
        </p>
      ) : null}
    </div>
  );
}

const columns: ColumnDef<NotificationRow>[] = [
  {
    id: "createdAt",
    accessorFn: (row) => new Date(row.createdAt).getTime(),
    header: "Tarih",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-[13px] tabular-nums text-muted-foreground">
        {formatDateTime(row.original.createdAt)}
      </span>
    ),
  },
  {
    id: "template",
    accessorFn: (row) => row.templateLabel,
    header: "Bildirim",
    cell: ({ row }) => (
      <div className="min-w-0 max-w-[320px]">
        <Link href={`/yonetim/bildirimler/${row.original.id}`} className="block truncate font-medium hover:underline">
          {row.original.subject || row.original.templateLabel}
        </Link>
        <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
          <ChannelIcon channel={row.original.channel} />
          <span className="font-mono">{row.original.template}</span>
          {row.original.redacted ? <Lock aria-label="Gizli içerik" className="size-3 shrink-0" /> : null}
          {row.original.isResend ? <span>· yeniden gönderim</span> : null}
        </p>
      </div>
    ),
  },
  {
    id: "to",
    accessorFn: (row) => row.to,
    header: "Alıcı",
    cell: ({ row }) => (
      <div className="min-w-0 max-w-[220px]">
        <p className="truncate font-mono text-[13px]">{row.original.to}</p>
        {row.original.customer ? (
          <Link
            href={`/yonetim/musteriler/${row.original.customer.id}`}
            className="block truncate text-xs text-muted-foreground hover:underline"
          >
            {row.original.customer.name}
          </Link>
        ) : (
          <p className="text-xs text-muted-foreground">Yönetim</p>
        )}
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Durum",
    enableSorting: false,
    cell: ({ row }) => <StatusCell row={row.original} />,
  },
  {
    id: "attempts",
    accessorFn: (row) => row.attempts,
    header: "Deneme",
    meta: { align: "right" },
    cell: ({ row }) => <span className="font-mono text-xs tabular-nums">{row.original.attempts}</span>,
  },
  {
    id: "actions",
    header: () => <span className="sr-only">İşlem</span>,
    enableSorting: false,
    meta: { align: "right", className: "w-px" },
    cell: ({ row }) => <ResendButton id={row.original.id} status={row.original.status} />,
  },
];

export function BildirimlerContent({ rows, total, page, totalPages, stats, templates, filters }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(filters.search);

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.push(`?${params.toString()}`);
  };

  const hasFilters = Boolean(filters.status || filters.channel || filters.template || filters.search);

  return (
    <>
      <PageHeader
        title="Bildirimler"
        description="Gönderilen e-posta ve SMS bildirimlerinin kaydı. Gizli içerikli bildirimlerde (şifre, tek kullanımlık bağlantı) değerler kayıtta şifreli tutulur."
        actions={
          <Link href="/yonetim/bildirimler/sablonlar" className={appButton({ variant: "outline" })}>
            <LayoutTemplate aria-hidden />
            Şablon önizleme
          </Link>
        }
      />

      <StatGrid columns={4}>
        <StatCard label="Gönderildi (24 saat)" value={stats.sent24h.toLocaleString("tr-TR")} tone={stats.sent24h ? "success" : undefined} hint="Son 24 saat" />
        <StatCard label="Sırada" value={stats.queued.toLocaleString("tr-TR")} tone={stats.queued ? "info" : undefined} hint="Kuyrukta bekleyen" />
        <StatCard label="Başarısız (24 saat)" value={stats.failed24h.toLocaleString("tr-TR")} tone={stats.failed24h ? "danger" : undefined} hint={stats.failed24h ? "Yeniden göndermeyi deneyin" : "Sorun yok"} />
        <StatCard label="Atlandı (24 saat)" value={stats.skipped24h.toLocaleString("tr-TR")} tone={stats.skipped24h ? "warning" : undefined} hint="Kanal kapalı / yapılandırılmamış" />
      </StatGrid>

      <SectionCard
        title="Filtreler"
        actions={
          hasFilters ? (
            <button type="button" onClick={() => router.push("/yonetim/bildirimler")} className={appButton({ variant: "ghost", size: "sm" })}>
              <X aria-hidden />
              Filtreleri temizle
            </button>
          ) : undefined
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Durum" htmlFor="f-status">
            <select id="f-status" value={filters.status} onChange={(e) => updateParam("status", e.target.value)} className={selectClass}>
              <option value="">Tümü</option>
              {getStatusOptions("notification").map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Kanal" htmlFor="f-channel">
            <select id="f-channel" value={filters.channel} onChange={(e) => updateParam("channel", e.target.value)} className={selectClass}>
              <option value="">Tümü</option>
              <option value="EMAIL">E-posta</option>
              <option value="SMS">SMS</option>
            </select>
          </FormField>
          <FormField label="Şablon" htmlFor="f-template">
            <select id="f-template" value={filters.template} onChange={(e) => updateParam("template", e.target.value)} className={selectClass}>
              <option value="">Tümü</option>
              {templates.map((template) => (
                <option key={template.key} value={template.key}>
                  {template.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Alıcı / konu" htmlFor="f-search">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                updateParam("search", search.trim());
              }}
            >
              <Input
                id="f-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="E-posta, telefon veya konu…"
                className="h-11 md:h-9"
              />
            </form>
          </FormField>
        </div>
      </SectionCard>

      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">{total.toLocaleString("tr-TR")} kayıt</p>
        <DataTable
          caption="Bildirim kayıtları"
          columns={columns}
          data={rows}
          getRowId={(row) => row.id}
          pageSize={0}
          initialSort={[{ id: "createdAt", desc: true }]}
          mobileCard={(row) => (
            <div className="space-y-3">
              <ListRow
                title={row.subject || row.templateLabel}
                subtitle={`${row.to} · ${formatDateTime(row.createdAt)}`}
                meta={
                  <>
                    <StatusBadge kind="notification" status={row.status} />
                    <span className="font-mono">{row.template}</span>
                  </>
                }
              />
              <div className="flex gap-2">
                <Link href={`/yonetim/bildirimler/${row.id}`} className={appButton({ variant: "ghost", size: "sm" })}>
                  <Eye aria-hidden />
                  Detay
                </Link>
                <ResendButton id={row.id} status={row.status} />
              </div>
            </div>
          )}
          emptyState={
            <EmptyState
              icon={Mail}
              title={hasFilters ? "Filtreye uyan bildirim yok" : "Henüz bildirim gönderilmedi"}
              description="Sipariş, ödeme, fatura ve hizmet olayları burada listelenir."
            />
          }
        />
        <ServerPager page={page} totalPages={totalPages} total={total} noun="bildirim" />
      </div>
    </>
  );
}
