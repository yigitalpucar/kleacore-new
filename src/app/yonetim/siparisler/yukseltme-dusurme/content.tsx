"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowRight, ArrowUp, ArrowUpDown, Check, Eye, UserRound } from "lucide-react";
import {
  DataTable,
  EmptyState,
  ListRow,
  PageHeader,
  StatCard,
  StatGrid,
  StatusBadge,
  appButton,
  type ColumnDef,
  type RowAction,
} from "@/components/app";
import { approvePendingPlanChangeDowngrade } from "@/lib/actions/admin/plan-changes";
import { toast } from "@/lib/toast";
import { formatDate } from "@/lib/format/date";
import { formatTRY } from "@/lib/format/price";

interface OperationItem {
  id: string;
  customer: string;
  customerId: string;
  companyName: string | null;
  orderId: string;
  type: "upgrade" | "downgrade";
  fromProduct: string;
  toProduct: string;
  priceDiff: number;
  status: string;
  date: string;
  planChangeId?: string | null;
  canApprove?: boolean;
}

interface YukseltmeDusurmeContentProps {
  operations: OperationItem[];
}

const TYPE_LABEL = { upgrade: "Yükseltme", downgrade: "Düşürme" } as const;
/** DAL statuses are lower-case: completed / pending / cancelled. */
const enumStatus = (s: string) => s.toUpperCase();
const hasOrder = (op: OperationItem) => op.orderId !== op.id;
const tr = (s: string | null | undefined) => (s ?? "").toLocaleLowerCase("tr-TR");

const formatPriceDiff = (price: number) => {
  if (!price) return "—";
  return `${price > 0 ? "+" : "−"}${formatTRY(Math.abs(price), { keepDecimals: true })}`;
};

function TypeLabel({ type }: { type: OperationItem["type"] }) {
  const Icon = type === "upgrade" ? ArrowUp : ArrowDown;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <Icon aria-hidden className="size-3.5 text-muted-foreground" />
      {TYPE_LABEL[type]}
    </span>
  );
}

function PlanPath({ op }: { op: OperationItem }) {
  return (
    <span className="inline-flex min-w-0 max-w-[320px] items-center gap-1.5">
      <span className="truncate text-muted-foreground">{op.fromProduct}</span>
      <ArrowRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground/70" />
      <span className="truncate font-medium">{op.toProduct}</span>
    </span>
  );
}

export function YukseltmeDusurmeContent({ operations }: YukseltmeDusurmeContentProps) {
  const router = useRouter();
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const handleApprove = async (planChangeId: string) => {
    if (approvingId) return;
    setApprovingId(planChangeId);
    const result = await approvePendingPlanChangeDowngrade(planChangeId);
    if (!result.success) {
      toast.error(result.error ?? "Düşürme talebi onaylanamadı");
      setApprovingId(null);
      return;
    }
    toast.success("Düşürme talebi onaylandı ve paket güncellendi");
    router.refresh();
    setApprovingId(null);
  };

  const upgrades = operations.filter((o) => o.type === "upgrade").length;
  const downgrades = operations.length - upgrades;
  const pending = operations.filter((o) => o.status === "pending").length;

  const columns: ColumnDef<OperationItem>[] = [
    {
      accessorKey: "customer",
      header: "Müşteri",
      cell: ({ row }) => (
        <div className="min-w-0 max-w-[200px]">
          <Link href={`/yonetim/musteriler/${row.original.customerId}`} className="block truncate font-medium hover:underline">
            {row.original.customer}
          </Link>
          {row.original.companyName ? (
            <p className="truncate text-xs text-muted-foreground">{row.original.companyName}</p>
          ) : null}
        </div>
      ),
    },
    {
      accessorKey: "type",
      header: "Tür",
      enableSorting: false,
      cell: ({ row }) => <TypeLabel type={row.original.type} />,
    },
    {
      id: "plan",
      header: "Paket",
      enableSorting: false,
      cell: ({ row }) => <PlanPath op={row.original} />,
    },
    {
      accessorKey: "priceDiff",
      header: "Fark",
      meta: { align: "right" },
      cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{formatPriceDiff(row.original.priceDiff)}</span>,
    },
    {
      accessorKey: "date",
      header: "Tarih",
      cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{formatDate(row.original.date)}</span>,
    },
    {
      accessorKey: "status",
      header: "Durum",
      enableSorting: false,
      cell: ({ row }) => <StatusBadge kind="planChange" status={enumStatus(row.original.status)} />,
    },
    {
      id: "decide",
      header: () => <span className="sr-only">İşlem</span>,
      enableSorting: false,
      meta: { align: "right", className: "w-px" },
      cell: ({ row }) => {
        const op = row.original;
        if (!op.canApprove || !op.planChangeId) return null;
        return (
          <button
            type="button"
            onClick={() => void handleApprove(op.planChangeId!)}
            disabled={approvingId !== null}
            className={appButton({ variant: "outline", size: "sm" })}
          >
            <Check aria-hidden />
            {approvingId === op.planChangeId ? "Onaylanıyor…" : "Onayla"}
          </button>
        );
      },
    },
  ];

  const rowActions = (op: OperationItem): RowAction[] => [
    ...(op.canApprove && op.planChangeId
      ? [{ label: "Düşürmeyi onayla", icon: <Check aria-hidden />, onSelect: () => void handleApprove(op.planChangeId!) }]
      : []),
    ...(hasOrder(op)
      ? [{ label: "Siparişi görüntüle", href: `/yonetim/siparisler/${op.orderId}`, icon: <Eye aria-hidden />, separator: !!op.canApprove }]
      : []),
    { label: "Müşteriyi görüntüle", href: `/yonetim/musteriler/${op.customerId}`, icon: <UserRound aria-hidden /> },
  ];

  return (
    <>
      <PageHeader
        title="Yükseltme ve düşürme"
        description="Paket değişikliği işlemleri. Yükseltmeler ödeme ile, düşürmeler yönetici onayıyla tamamlanır."
      />

      <StatGrid columns={3} className="grid-cols-1 sm:grid-cols-3">
        <StatCard label="Yükseltme" value={upgrades.toLocaleString("tr-TR")} hint="Tüm kayıtlar" />
        <StatCard label="Düşürme" value={downgrades.toLocaleString("tr-TR")} hint="Tüm kayıtlar" />
        <StatCard
          label="Bekleyen"
          value={pending.toLocaleString("tr-TR")}
          hint={pending ? "Ödeme veya onay bekliyor" : "Bekleyen işlem yok"}
          tone={pending ? "warning" : undefined}
        />
      </StatGrid>

      <DataTable
        caption="Paket değişiklikleri"
        columns={columns}
        data={operations}
        initialSort={[{ id: "date", desc: true }]}
        searchFn={(op, q) =>
          tr(op.customer).includes(q) || tr(op.companyName).includes(q) || tr(op.fromProduct).includes(q) || tr(op.toProduct).includes(q)
        }
        searchPlaceholder="Müşteri veya paket ara…"
        filters={[
          {
            id: "type",
            label: "Tür",
            options: [
              { value: "upgrade", label: "Yükseltme" },
              { value: "downgrade", label: "Düşürme" },
            ],
            getValue: (op) => op.type,
          },
        ]}
        rowHref={(op) => (hasOrder(op) ? `/yonetim/siparisler/${op.orderId}` : `/yonetim/musteriler/${op.customerId}`)}
        rowActions={rowActions}
        mobileCard={(op) => (
          <ListRow
            title={op.customer}
            subtitle={`${op.fromProduct} → ${op.toProduct}`}
            trailing={op.priceDiff ? formatPriceDiff(op.priceDiff) : undefined}
            meta={
              <>
                <StatusBadge kind="planChange" status={enumStatus(op.status)} />
                <TypeLabel type={op.type} />
                <span>{formatDate(op.date)}</span>
              </>
            }
          />
        )}
        emptyState={
          <EmptyState
            icon={ArrowUpDown}
            title="Paket değişikliği yok"
            description="Müşteriler paket yükseltip düşürdüğünde burada listelenir."
          />
        }
        noResultsText="Aramanızla eşleşen işlem bulunamadı."
      />
    </>
  );
}
