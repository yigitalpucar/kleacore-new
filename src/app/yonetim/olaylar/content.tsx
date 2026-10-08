"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Radio, X } from "lucide-react";
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
  ToneDot,
  appButton,
  type ColumnDef,
} from "@/components/app";
import { ServerPager } from "@/components/admin/server-pager";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format/date";
import { DELIVERY_STATUS_META, EVENT_STATE_META, SUBSCRIBER_LABELS } from "./state";

export interface EventRow {
  id: string;
  type: string;
  label: string;
  aggregateType: string;
  aggregateId: string;
  occurredAt: string;
  processedAt: string | null;
  attempts: number;
  lastError: string | null;
  state: string;
  deliveries: Array<{ subscriber: string; status: string }>;
}

interface Option {
  value: string;
  label: string;
}

interface Props {
  rows: EventRow[];
  total: number;
  page: number;
  totalPages: number;
  stats: { last24h: number; unprocessed: number; failed: number; failedDeliveries: number };
  types: Option[];
  subscribers: Option[];
  filters: { type: string; state: string; aggregate: string; subscriber: string };
}

const selectClass =
  "h-11 w-full rounded-md border bg-background px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-9";

function StateBadge({ state }: { state: string }) {
  const meta = EVENT_STATE_META[state] ?? { label: state, tone: "neutral" as const };
  return <StatusBadge tone={meta.tone} label={meta.label} />;
}

function Deliveries({ deliveries }: { deliveries: EventRow["deliveries"] }) {
  if (deliveries.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1">
      {deliveries.map((delivery) => {
        const meta = DELIVERY_STATUS_META[delivery.status] ?? { label: delivery.status, tone: "neutral" as const };
        return (
          <li key={delivery.subscriber} className="flex items-center gap-1.5 text-xs text-muted-foreground" title={meta.label}>
            <ToneDot tone={meta.tone} />
            {SUBSCRIBER_LABELS[delivery.subscriber] ?? delivery.subscriber}
          </li>
        );
      })}
    </ul>
  );
}

const columns: ColumnDef<EventRow>[] = [
  {
    id: "occurredAt",
    accessorFn: (row) => new Date(row.occurredAt).getTime(),
    header: "Tarih",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-[13px] tabular-nums text-muted-foreground">
        {formatDateTime(row.original.occurredAt)}
      </span>
    ),
  },
  {
    id: "type",
    accessorFn: (row) => row.label,
    header: "Olay",
    cell: ({ row }) => (
      <div className="min-w-0 max-w-[280px]">
        <Link href={`/yonetim/olaylar/${row.original.id}`} className="block truncate font-medium hover:underline">
          {row.original.label}
        </Link>
        <p className="truncate font-mono text-xs text-muted-foreground">{row.original.type}</p>
      </div>
    ),
  },
  {
    id: "aggregate",
    accessorFn: (row) => row.aggregateId,
    header: "Kayıt",
    cell: ({ row }) => (
      <div className="min-w-0 max-w-[200px]">
        <p className="text-xs text-muted-foreground">{row.original.aggregateType}</p>
        <p className="truncate font-mono text-[13px]">{row.original.aggregateId}</p>
      </div>
    ),
  },
  {
    accessorKey: "state",
    header: "Durum",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="min-w-0 space-y-1">
        <StateBadge state={row.original.state} />
        {row.original.lastError && row.original.state !== "PROCESSED" ? (
          <p className="max-w-[220px] truncate text-xs text-muted-foreground" title={row.original.lastError}>
            {row.original.lastError}
          </p>
        ) : null}
      </div>
    ),
  },
  {
    id: "deliveries",
    header: "Aboneler",
    enableSorting: false,
    cell: ({ row }) => <Deliveries deliveries={row.original.deliveries} />,
  },
  {
    id: "attempts",
    accessorFn: (row) => row.attempts,
    header: "Deneme",
    meta: { align: "right" },
    cell: ({ row }) => <span className="font-mono text-xs tabular-nums">{row.original.attempts}</span>,
  },
];

export function OlaylarContent({ rows, total, page, totalPages, stats, types, subscribers, filters }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [aggregate, setAggregate] = useState(filters.aggregate);

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    router.push(`?${params.toString()}`);
  };

  const hasFilters = Boolean(filters.type || filters.state || filters.aggregate || filters.subscriber);

  return (
    <>
      <PageHeader
        title="Olaylar"
        description="İş olayları (ödeme, fatura, hizmet, alan adı, destek, hesap) işlemle aynı anda kaydedilir ve kayıttan sonra abonelere dağıtılır: bildirim, e-fatura, webhook, aktivite kaydı ve yönetim uyarısı. Her abone bir olayı en fazla bir kez işler."
      />

      <StatGrid columns={4}>
        <StatCard label="Son 24 saat" value={stats.last24h.toLocaleString("tr-TR")} hint="Kaydedilen olay" />
        <StatCard
          label="Dağıtılmayı bekleyen"
          value={stats.unprocessed.toLocaleString("tr-TR")}
          tone={stats.unprocessed ? "info" : undefined}
          hint="Sırada veya yeniden denenecek"
        />
        <StatCard
          label="Başarısız olay"
          value={stats.failed.toLocaleString("tr-TR")}
          tone={stats.failed ? "danger" : undefined}
          hint={stats.failed ? "Yeniden dağıtmayı deneyin" : "Sorun yok"}
        />
        <StatCard
          label="Başarısız teslim"
          value={stats.failedDeliveries.toLocaleString("tr-TR")}
          tone={stats.failedDeliveries ? "warning" : undefined}
          hint="Abone bazında"
        />
      </StatGrid>

      <SectionCard
        title="Filtreler"
        actions={
          hasFilters ? (
            <button type="button" onClick={() => router.push("/yonetim/olaylar")} className={appButton({ variant: "ghost", size: "sm" })}>
              <X aria-hidden />
              Filtreleri temizle
            </button>
          ) : undefined
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Olay türü" htmlFor="f-type">
            <select id="f-type" value={filters.type} onChange={(e) => updateParam("type", e.target.value)} className={selectClass}>
              <option value="">Tümü</option>
              {types.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label} ({option.value})
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Durum" htmlFor="f-state">
            <select id="f-state" value={filters.state} onChange={(e) => updateParam("state", e.target.value)} className={selectClass}>
              <option value="">Tümü</option>
              {Object.entries(EVENT_STATE_META).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Başarısız abone" htmlFor="f-subscriber">
            <select
              id="f-subscriber"
              value={filters.subscriber}
              onChange={(e) => updateParam("subscriber", e.target.value)}
              className={selectClass}
            >
              <option value="">Tümü</option>
              {subscribers.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Kayıt no" htmlFor="f-aggregate">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                updateParam("aggregate", aggregate.trim());
              }}
            >
              <Input
                id="f-aggregate"
                type="search"
                value={aggregate}
                onChange={(event) => setAggregate(event.target.value)}
                placeholder="Fatura, hizmet, alan adı kimliği…"
                className="h-11 md:h-9"
              />
            </form>
          </FormField>
        </div>
      </SectionCard>

      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">{total.toLocaleString("tr-TR")} olay</p>
        <DataTable
          caption="Olay kayıtları"
          columns={columns}
          data={rows}
          getRowId={(row) => row.id}
          pageSize={0}
          initialSort={[{ id: "occurredAt", desc: true }]}
          rowHref={(row) => `/yonetim/olaylar/${row.id}`}
          mobileCard={(row) => (
            <ListRow
              title={row.label}
              subtitle={`${row.aggregateType} · ${formatDateTime(row.occurredAt)}`}
              meta={
                <>
                  <StateBadge state={row.state} />
                  <span className="font-mono">{row.type}</span>
                </>
              }
            />
          )}
          emptyState={
            <EmptyState
              icon={Radio}
              title={hasFilters ? "Filtreye uyan olay yok" : "Henüz olay kaydedilmedi"}
              description="Ödeme, fatura, hizmet ve alan adı işlemleri burada olay olarak listelenir."
            />
          }
        />
        <ServerPager page={page} totalPages={totalPages} total={total} noun="olay" />
      </div>
    </>
  );
}
