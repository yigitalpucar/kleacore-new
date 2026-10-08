"use client";

import { ROLE_LABELS, isStaffRole } from "@/lib/auth/permissions";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ScrollText, Search, X } from "lucide-react";
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
  type ColumnDef,
} from "@/components/app";
import { ServerPager } from "@/components/admin/server-pager";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format/date";
import type { Prisma } from "@prisma/client";

interface ActivityLogUser {
  id: string;
  name: string;
  surname: string;
  email: string;
  role: string;
}

interface ActivityLogItem {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: Prisma.JsonValue | null;
  ipAddress: string | null;
  createdAt: string;
  user: ActivityLogUser;
}

interface Stats {
  total: number;
  todayCount: number;
  adminCount: number;
  customerCount: number;
}

interface FilterOptions {
  entities: string[];
  actions: string[];
}

interface Filters {
  userId: string;
  entity: string;
  action: string;
  dateFrom: string;
  dateTo: string;
  search: string;
}

interface AktiviteContentProps {
  data: ActivityLogItem[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
  stats: Stats;
  filterOptions: FilterOptions;
  activityUsers: ActivityLogUser[];
  filters: Filters;
}

const actionLabels: Record<string, string> = {
  LOGIN: "Giriş",
  LOGIN_FAILED: "Başarısız giriş",
  UPDATE_SETTINGS: "Ayar güncelleme",
  APPROVE_ORDER: "Sipariş onayı",
  CREATE_ORDER: "Sipariş oluşturma",
  UPDATE_PROFILE: "Profil güncelleme",
  CREATE_TICKET: "Destek talebi",
  SUSPEND_SERVICE: "Hizmet askıya alma",
  INVOICE_PAID: "Fatura ödemesi",
  CREATE_CUSTOMER: "Müşteri oluşturma",
  ORDER_STATUS_CHANGE: "Sipariş durum değişikliği",
};

const entityLabels: Record<string, string> = {
  Session: "Oturum",
  Setting: "Ayar",
  Order: "Sipariş",
  User: "Kullanıcı",
  SupportTicket: "Destek talebi",
  Service: "Hizmet",
  Invoice: "Fatura",
};

function formatAction(action: string) {
  return actionLabels[action] ?? action.replace(/_/g, " ");
}

function formatEntity(entity: string) {
  return entityLabels[entity] ?? entity;
}

function formatDetails(details: Prisma.JsonValue | null) {
  if (details === null || details === undefined) return null;
  if (typeof details === "string") return details;
  try {
    return JSON.stringify(details, null, 0);
  } catch {
    return String(details);
  }
}

function getEntityLink(entity: string, entityId: string | null) {
  if (!entityId) return null;
  switch (entity) {
    case "Order":
      return `/yonetim/siparisler/${entityId}`;
    case "Invoice":
      return `/yonetim/faturalar/${entityId}`;
    case "Service":
      return `/yonetim/hizmetler/${entityId}`;
    case "User":
      return `/yonetim/musteriler/${entityId}`;
    case "SupportTicket":
      return `/yonetim/destek/${entityId}`;
    default:
      return null;
  }
}

const userName = (u: ActivityLogUser) => `${u.name} ${u.surname}`.trim() || u.email;

function RoleBadge({ role }: { role: string }) {
  return isStaffRole(role) ? (
    <StatusBadge tone="neutral" label={ROLE_LABELS[role]} />
  ) : (
    <StatusBadge tone="muted" label="Müşteri" />
  );
}

function EntityCell({ log }: { log: ActivityLogItem }) {
  const link = getEntityLink(log.entity, log.entityId);
  return (
    <div className="min-w-0">
      <p className="text-sm">{formatEntity(log.entity)}</p>
      {log.entityId ? (
        link ? (
          <Link href={link} className="block max-w-[130px] truncate font-mono text-[11px] text-muted-foreground hover:text-foreground hover:underline">
            {log.entityId}
          </Link>
        ) : (
          <p className="max-w-[130px] truncate font-mono text-[11px] text-muted-foreground">{log.entityId}</p>
        )
      ) : null}
    </div>
  );
}

const columns: ColumnDef<ActivityLogItem>[] = [
  {
    id: "createdAt",
    accessorFn: (r) => r.createdAt,
    header: "Tarih",
    cell: ({ row }) => (
      <span className="whitespace-nowrap tabular-nums text-muted-foreground">{formatDateTime(row.original.createdAt)}</span>
    ),
  },
  {
    id: "user",
    accessorFn: (r) => userName(r.user),
    header: "Kullanıcı",
    cell: ({ row }) => {
      const u = row.original.user;
      return (
        <div className="min-w-0 max-w-[220px]">
          <p className="flex items-center gap-2">
            <span className="truncate font-medium">{userName(u)}</span>
            <RoleBadge role={u.role} />
          </p>
          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
        </div>
      );
    },
  },
  {
    accessorKey: "action",
    header: "İşlem",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="font-medium">{formatAction(row.original.action)}</p>
        {actionLabels[row.original.action] ? (
          <p className="font-mono text-[11px] text-muted-foreground">{row.original.action}</p>
        ) : null}
      </div>
    ),
  },
  {
    accessorKey: "entity",
    header: "Varlık",
    cell: ({ row }) => <EntityCell log={row.original} />,
  },
  {
    id: "details",
    header: "Detay",
    enableSorting: false,
    cell: ({ row }) => {
      const text = formatDetails(row.original.details);
      return text ? (
        <p title={text} className="max-w-[200px] truncate font-mono text-[11px] text-muted-foreground">
          {text}
        </p>
      ) : (
        <span className="text-muted-foreground">—</span>
      );
    },
  },
  {
    accessorKey: "ipAddress",
    header: "IP",
    cell: ({ row }) => (
      <span className="whitespace-nowrap font-mono text-[12px] text-muted-foreground">{row.original.ipAddress ?? "—"}</span>
    ),
  },
];

const selectClass =
  "h-11 w-full rounded-md border bg-background px-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-9";

export function AktiviteContent({
  data,
  total,
  page,
  totalPages,
  stats,
  filterOptions,
  activityUsers,
  filters,
}: AktiviteContentProps) {
  const router = useRouter();
  const searchParamsHook = useSearchParams();

  const updateParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParamsHook.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    if (key !== "page") {
      params.set("page", "1");
    }
    router.push(`?${params.toString()}`);
  };

  const clearFilters = () => {
    router.push("/yonetim/aktivite");
  };

  const hasActiveFilters =
    filters.userId || filters.entity || filters.action || filters.dateFrom || filters.dateTo || filters.search;

  return (
    <>
      <PageHeader
        title="Aktivite kayıtları"
        description="Kullanıcı ve yönetici işlemlerinin denetim kaydı. Filtreler sunucuda uygulanır."
      />

      <StatGrid columns={4}>
        <StatCard label="Toplam kayıt" value={stats.total.toLocaleString("tr-TR")} />
        <StatCard label="Bugün" value={stats.todayCount.toLocaleString("tr-TR")} />
        <StatCard label="Yönetici işlemleri" value={stats.adminCount.toLocaleString("tr-TR")} />
        <StatCard label="Müşteri işlemleri" value={stats.customerCount.toLocaleString("tr-TR")} />
      </StatGrid>

      <SectionCard
        title="Filtreler"
        actions={
          hasActiveFilters ? (
            <button type="button" onClick={clearFilters} className={appButton({ variant: "ghost", size: "sm" })}>
              <X aria-hidden />
              Filtreleri temizle
            </button>
          ) : undefined
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <FormField label="Kullanıcı" htmlFor="f-user">
            <select id="f-user" value={filters.userId} onChange={(e) => updateParams("userId", e.target.value)} className={selectClass}>
              <option value="">Tümü</option>
              {activityUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {`${user.name} ${user.surname}`.trim()}
                  {isStaffRole(user.role) ? ` (${ROLE_LABELS[user.role]})` : ""}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Varlık" htmlFor="f-entity">
            <select id="f-entity" value={filters.entity} onChange={(e) => updateParams("entity", e.target.value)} className={selectClass}>
              <option value="">Tümü</option>
              {filterOptions.entities.map((entity) => (
                <option key={entity} value={entity}>
                  {formatEntity(entity)}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="İşlem" htmlFor="f-action">
            <select id="f-action" value={filters.action} onChange={(e) => updateParams("action", e.target.value)} className={selectClass}>
              <option value="">Tümü</option>
              {filterOptions.actions.map((action) => (
                <option key={action} value={action}>
                  {formatAction(action)}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Başlangıç" htmlFor="f-from">
            <Input
              id="f-from"
              type="date"
              value={filters.dateFrom}
              onChange={(e) => updateParams("dateFrom", e.target.value)}
              className="h-11 md:h-9"
            />
          </FormField>

          <FormField label="Bitiş" htmlFor="f-to">
            <Input
              id="f-to"
              type="date"
              value={filters.dateTo}
              onChange={(e) => updateParams("dateTo", e.target.value)}
              className="h-11 md:h-9"
            />
          </FormField>

          <FormField label="Ara" htmlFor="f-search" hint="Enter ile uygulanır">
            <div className="relative">
              <Search aria-hidden className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="f-search"
                type="search"
                placeholder="İşlem, kullanıcı, IP…"
                defaultValue={filters.search}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    updateParams("search", e.currentTarget.value);
                  }
                }}
                onBlur={(e) => {
                  if (e.target.value !== filters.search) {
                    updateParams("search", e.target.value);
                  }
                }}
                className="h-11 pl-9 md:h-9"
              />
            </div>
          </FormField>
        </div>
      </SectionCard>

      <DataTable
        caption="Aktivite kayıtları"
        columns={columns}
        data={data}
        pageSize={0}
        initialSort={[{ id: "createdAt", desc: true }]}
        mobileCard={(log) => (
          <ListRow
            title={formatAction(log.action)}
            subtitle={`${userName(log.user)} · ${formatEntity(log.entity)}`}
            meta={
              <>
                <RoleBadge role={log.user.role} />
                <span>{formatDateTime(log.createdAt)}</span>
                {log.ipAddress ? <span className="font-mono">{log.ipAddress}</span> : null}
              </>
            }
          />
        )}
        emptyState={
          <EmptyState
            icon={ScrollText}
            title={hasActiveFilters ? "Filtrelerle eşleşen kayıt yok" : "Henüz aktivite kaydı yok"}
            description={hasActiveFilters ? "Filtreleri değiştirin ya da temizleyin." : "Sistemde yapılan işlemler burada listelenir."}
            action={
              hasActiveFilters ? (
                <button type="button" onClick={clearFilters} className={appButton({ variant: "outline", size: "sm" })}>
                  Filtreleri temizle
                </button>
              ) : undefined
            }
          />
        }
      />
      <ServerPager page={page} totalPages={totalPages} total={total} noun="kayıt" />
    </>
  );
}
