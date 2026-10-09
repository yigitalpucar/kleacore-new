"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Megaphone, Plus } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { setBroadcastRateAction } from "@/lib/actions/admin/broadcasts";
import { formatDateTime } from "@/lib/format/date";
import { toast } from "@/lib/toast";

export type BroadcastListRow = {
  id: string;
  kind: "SERVICE" | "MARKETING";
  subject: string;
  channels: string[];
  audience: string;
  status: string;
  scheduledAt: string | null;
  createdAt: string;
  total: number;
  sent: number;
  failed: number;
};

const KIND_LABEL = { SERVICE: "Hizmet / bakım", MARKETING: "Kampanya" } as const;
const CHANNEL_LABEL: Record<string, string> = { EMAIL: "E-posta", SMS: "SMS" };

function progressText(row: BroadcastListRow) {
  if (row.status === "DRAFT") return "—";
  if (row.status === "SCHEDULED" && row.total === 0) return row.scheduledAt ? formatDateTime(row.scheduledAt) : "Sırada";
  return `${row.sent.toLocaleString("tr-TR")} / ${row.total.toLocaleString("tr-TR")}${row.failed ? ` · ${row.failed} hata` : ""}`;
}

const columns: ColumnDef<BroadcastListRow>[] = [
  {
    accessorKey: "subject",
    header: "Konu",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="truncate font-medium">{row.original.subject}</p>
        <p className="truncate text-xs text-muted-foreground">{row.original.audience}</p>
      </div>
    ),
  },
  {
    accessorKey: "kind",
    header: "Tür",
    cell: ({ row }) => (
      <span className="text-sm">
        {KIND_LABEL[row.original.kind]}
        <span className="block text-xs text-muted-foreground">{row.original.channels.map((c) => CHANNEL_LABEL[c] ?? c).join(" + ")}</span>
      </span>
    ),
  },
  {
    id: "progress",
    accessorFn: (row) => row.sent,
    header: "Gönderim",
    meta: { align: "right" },
    cell: ({ row }) => <span className="font-mono text-xs">{progressText(row.original)}</span>,
  },
  {
    accessorKey: "status",
    header: "Durum",
    enableSorting: false,
    cell: ({ row }) => <StatusBadge kind="broadcast" status={row.original.status} />,
  },
  {
    id: "created",
    accessorFn: (row) => row.createdAt,
    header: "Oluşturma",
    cell: ({ row }) => <span className="text-sm text-muted-foreground">{formatDateTime(row.original.createdAt)}</span>,
  },
];

export function DuyurularContent({ rows, rate }: { rows: BroadcastListRow[]; rate: number }) {
  const sending = rows.filter((row) => row.status === "SENDING").length;
  const scheduled = rows.filter((row) => row.status === "SCHEDULED").length;
  const sent = rows.reduce((sum, row) => sum + row.sent, 0);

  return (
    <>
      <PageHeader
        title="Duyurular"
        description="Bakım, hizmet değişikliği ve kampanya duyurularını seçtiğiniz müşterilere e-posta ve SMS ile gönderin. Hizmet duyuruları etkilenen herkese, kampanyalar yalnızca ticari ileti onayı verenlere gider."
        actions={
          <Link href="/yonetim/duyurular/yeni" className={appButton()}>
            <Plus aria-hidden />
            Yeni duyuru
          </Link>
        }
      />

      <StatGrid columns={4}>
        <StatCard label="Duyuru" value={rows.length.toLocaleString("tr-TR")} hint="Son 200 kayıt" />
        <StatCard label="Gönderiliyor" value={String(sending)} tone={sending ? "warning" : undefined} hint="Şu anda kuyrukta" />
        <StatCard label="Zamanlanmış" value={String(scheduled)} tone={scheduled ? "info" : undefined} hint="İleri tarihli" />
        <StatCard label="Gönderilen mesaj" value={sent.toLocaleString("tr-TR")} hint={`Hız: ${rate} mesaj/dakika`} />
      </StatGrid>

      <DataTable
        columns={columns}
        data={rows}
        searchFn={(row, q) => row.subject.toLocaleLowerCase("tr-TR").includes(q) || row.audience.toLocaleLowerCase("tr-TR").includes(q)}
        searchPlaceholder="Konu veya hedef kitle ara…"
        filters={[
          { id: "status", label: "Durum", options: getStatusOptions("broadcast"), getValue: (row) => row.status },
        ]}
        initialSort={[{ id: "created", desc: true }]}
        rowHref={(row) => `/yonetim/duyurular/${row.id}`}
        mobileCard={(row) => (
          <ListRow
            title={row.subject}
            subtitle={`${KIND_LABEL[row.kind]} · ${row.audience}`}
            trailing={<span className="font-mono text-xs">{progressText(row)}</span>}
            meta={<StatusBadge kind="broadcast" status={row.status} />}
          />
        )}
        emptyState={
          <EmptyState
            icon={Megaphone}
            title="Henüz duyuru yok"
            description="Planlı bakım veya hizmet değişikliklerini etkilenen müşterilere tek seferde duyurun."
            action={
              <Link href="/yonetim/duyurular/yeni" className={appButton()}>
                Yeni duyuru
              </Link>
            }
          />
        }
      />

      <RateSettings rate={rate} />
    </>
  );
}

function RateSettings({ rate }: { rate: number }) {
  const router = useRouter();
  const [value, setValue] = useState(String(rate));
  const [pending, start] = useTransition();

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const result = await setBroadcastRateAction(Number(value));
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Gönderim hızı ${result.data.rate} mesaj/dakika olarak kaydedildi`);
      router.refresh();
    });
  };

  return (
    <SectionCard
      title="Gönderim hızı"
      description="Duyurular partiler hâlinde gönderilir: her dakika en fazla bu kadar mesaj (alıcı × kanal) kuyruğa alınır. SMTP veya SMS sağlayıcınızın limitlerine göre ayarlayın."
    >
      <form onSubmit={save} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <FormField label="Mesaj / dakika" htmlFor="broadcast-rate" hint="1–1000">
          <Input
            id="broadcast-rate"
            type="number"
            min={1}
            max={1000}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-11 w-40 md:h-10"
          />
        </FormField>
        <button type="submit" disabled={pending} className={appButton({ variant: "outline" })}>
          {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
          Kaydet
        </button>
      </form>
    </SectionCard>
  );
}
