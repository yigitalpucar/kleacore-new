"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Eye, MessageSquareX, Package, UserRound, X } from "lucide-react";
import {
  DataTable,
  EmptyState,
  ListRow,
  PageHeader,
  StatCard,
  StatGrid,
  StatusBadge,
  appButton,
  getStatusOptions,
  type ColumnDef,
  type RowAction,
} from "@/components/app";
import {
  approveCancellationRequest,
  rejectCancellationRequest,
} from "@/lib/actions/admin/cancellation-requests";
import { toast } from "@/lib/toast";
import { formatDate } from "@/lib/format/date";
import { money } from "../_components/order-list";

interface CancellationRequest {
  id: string;
  customer: string;
  customerId: string;
  companyName: string | null;
  orderId: string;
  serviceId?: string | null;
  product: string;
  reason: string;
  requestedAt: string;
  resolvedAt?: string | null;
  status: string;
  adminNotes?: string | null;
  refundAmount: number;
}

interface IptalTalepleriContentProps {
  requests: CancellationRequest[];
}

/** DAL returns lower-case statuses; the status map uses the Prisma enum. */
const enumStatus = (s: string) => s.toUpperCase();
const tr = (s: string | null | undefined) => (s ?? "").toLocaleLowerCase("tr-TR");

export function IptalTalepleriContent({ requests: initialRequests }: IptalTalepleriContentProps) {
  const [requests, setRequests] = useState(initialRequests);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleApprove = async (requestId: string) => {
    setBusyId(requestId);
    try {
      const result = await approveCancellationRequest(requestId);
      if (!result.success) {
        toast.error(result.error || "Talep onaylanamadı");
        return;
      }
      setRequests((prev) => prev.map((req) => (req.id === requestId ? { ...req, status: "approved" } : req)));
      toast.success("İptal talebi onaylandı");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    const reason = prompt("Red nedeni (opsiyonel):") ?? "";
    setBusyId(requestId);
    try {
      const result = await rejectCancellationRequest(requestId, reason);
      if (!result.success) {
        toast.error(result.error || "Talep reddedilemedi");
        return;
      }
      setRequests((prev) => prev.map((req) => (req.id === requestId ? { ...req, status: "rejected" } : req)));
      toast.success("İptal talebi reddedildi");
    } finally {
      setBusyId(null);
    }
  };

  const pending = requests.filter((r) => r.status === "pending").length;
  const approved = requests.filter((r) => r.status === "approved").length;
  const rejected = requests.filter((r) => r.status === "rejected").length;

  const columns: ColumnDef<CancellationRequest>[] = [
    {
      accessorKey: "customer",
      header: "Müşteri",
      cell: ({ row }) => (
        <div className="min-w-0 max-w-[220px]">
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
      accessorKey: "product",
      header: "Ürün",
      cell: ({ row }) => <span className="block max-w-[200px] truncate">{row.original.product}</span>,
    },
    {
      accessorKey: "reason",
      header: "Neden",
      enableSorting: false,
      cell: ({ row }) => (
        <p className="line-clamp-2 max-w-[280px] text-muted-foreground" title={row.original.reason}>
          {row.original.reason}
        </p>
      ),
    },
    {
      accessorKey: "requestedAt",
      header: "Talep tarihi",
      cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{formatDate(row.original.requestedAt)}</span>,
    },
    {
      accessorKey: "refundAmount",
      header: "İade",
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="whitespace-nowrap tabular-nums">
          {row.original.refundAmount > 0 ? money(row.original.refundAmount) : "—"}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Durum",
      enableSorting: false,
      cell: ({ row }) => <StatusBadge kind="cancellation" status={enumStatus(row.original.status)} />,
    },
    {
      id: "decide",
      header: () => <span className="sr-only">Karar</span>,
      enableSorting: false,
      meta: { align: "right", className: "w-px" },
      cell: ({ row }) =>
        row.original.status === "pending" ? (
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              disabled={busyId !== null}
              onClick={() => void handleApprove(row.original.id)}
              className={appButton({ variant: "outline", size: "sm" })}
            >
              <Check aria-hidden />
              {busyId === row.original.id ? "İşleniyor…" : "Onayla"}
            </button>
            <button
              type="button"
              disabled={busyId !== null}
              onClick={() => void handleReject(row.original.id)}
              aria-label={`${row.original.customer} talebini reddet`}
              className={appButton({ variant: "ghost", size: "icon-sm" })}
            >
              <X aria-hidden />
            </button>
          </div>
        ) : null,
    },
  ];

  const rowActions = (r: CancellationRequest): RowAction[] => [
    ...(r.status === "pending"
      ? [
          { label: "Onayla", icon: <Check aria-hidden />, onSelect: () => void handleApprove(r.id) },
          { label: "Reddet", icon: <X aria-hidden />, onSelect: () => void handleReject(r.id), destructive: true },
        ]
      : []),
    ...(r.orderId
      ? [{ label: "Siparişi görüntüle", href: `/yonetim/siparisler/${r.orderId}`, icon: <Eye aria-hidden />, separator: r.status === "pending" }]
      : []),
    ...(r.serviceId
      ? [{ label: "Hizmeti görüntüle", href: `/yonetim/hizmetler/${r.serviceId}`, icon: <Package aria-hidden /> }]
      : []),
    { label: "Müşteriyi görüntüle", href: `/yonetim/musteriler/${r.customerId}`, icon: <UserRound aria-hidden /> },
  ];

  return (
    <>
      <PageHeader
        title="İptal talepleri"
        description="Müşterilerin hizmet ve sipariş iptal talepleri. Onaylanan talepler ilgili hizmeti iptal eder."
      />

      <StatGrid columns={3} className="grid-cols-1 sm:grid-cols-3">
        <StatCard
          label="Bekleyen"
          value={pending.toLocaleString("tr-TR")}
          hint={pending ? "Yanıt bekliyor" : "Bekleyen talep yok"}
          tone={pending ? "warning" : undefined}
        />
        <StatCard label="Onaylanan" value={approved.toLocaleString("tr-TR")} hint="Tüm zamanlar" />
        <StatCard label="Reddedilen" value={rejected.toLocaleString("tr-TR")} hint="Tüm zamanlar" />
      </StatGrid>

      <DataTable
        caption="İptal talepleri"
        columns={columns}
        data={requests}
        initialSort={[{ id: "requestedAt", desc: true }]}
        searchFn={(r, q) => tr(r.customer).includes(q) || tr(r.companyName).includes(q) || tr(r.product).includes(q) || tr(r.reason).includes(q)}
        searchPlaceholder="Müşteri, ürün veya neden ara…"
        filters={[
          {
            id: "status",
            label: "Durum",
            options: getStatusOptions("cancellation").map((o) => ({ ...o, value: o.value.toLowerCase() })),
            getValue: (r) => r.status,
          },
        ]}
        rowHref={(r) => (r.orderId ? `/yonetim/siparisler/${r.orderId}` : `/yonetim/musteriler/${r.customerId}`)}
        rowActions={rowActions}
        mobileCard={(r) => (
          <ListRow
            title={r.customer}
            subtitle={r.product}
            trailing={r.refundAmount > 0 ? money(r.refundAmount) : undefined}
            meta={
              <>
                <StatusBadge kind="cancellation" status={enumStatus(r.status)} />
                <span>{formatDate(r.requestedAt)}</span>
                <span className="w-full line-clamp-2">{r.reason}</span>
              </>
            }
          />
        )}
        emptyState={
          <EmptyState
            icon={MessageSquareX}
            title="İptal talebi yok"
            description="Müşteriler panelden iptal talebi gönderdiğinde burada listelenir."
          />
        }
        noResultsText="Aramanızla eşleşen talep bulunamadı."
      />
    </>
  );
}
