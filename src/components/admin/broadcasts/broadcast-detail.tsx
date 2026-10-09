"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Loader2, RotateCcw, Send, Trash2 } from "lucide-react";
import {
  DataTable,
  DetailList,
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
import { fromLocalInput } from "@/components/admin-b/durum/shared";
import { Input } from "@/components/ui/input";
import {
  cancelBroadcastAction,
  deleteBroadcastDraftAction,
  getBroadcastProgressAction,
  resendFailedBroadcastAction,
  startBroadcastAction,
} from "@/lib/actions/admin/broadcasts";
import type { RecipientCounts } from "@/lib/broadcasts/progress";
import { formatDateTime } from "@/lib/format/date";
import { toast } from "@/lib/toast";

type Broadcast = {
  id: string;
  kind: "SERVICE" | "MARKETING";
  subject: string;
  channels: string[];
  status: string;
  audience: string;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  createdBy: string;
  incident: { id: string; title: string } | null;
};

type Recipient = {
  id: string;
  channel: string;
  to: string;
  status: string;
  error: string | null;
  attempt: number;
  sentAt: string | null;
  updatedAt: string;
  notificationLogId: string | null;
  customer: { id: string; name: string };
};

const KIND_LABEL = { SERVICE: "Hizmet / bakım duyurusu", MARKETING: "Kampanya" } as const;
const CHANNEL_LABEL: Record<string, string> = { EMAIL: "E-posta", SMS: "SMS" };

const ERROR_LABEL: Record<string, string> = {
  OPTED_OUT: "Ticari ileti onayını geri aldı",
  CANCELLED: "Gönderim iptal edildi",
  BROADCAST_CANCELLED: "Gönderim iptal edildi",
  SMS_DISABLED: "SMS bildirimleri kapalı / sağlayıcı yok",
  NO_SMS_TEXT: "SMS metni yok",
  NO_ADDRESS: "Adres yok",
  SMTP_NOT_CONFIGURED: "SMTP ayarlı değil",
  EMAIL_NOTIFICATIONS_DISABLED: "E-posta bildirimleri kapalı",
};

const ACTIVE = new Set(["SCHEDULED", "SENDING"]);

const columns: ColumnDef<Recipient>[] = [
  {
    id: "customer",
    accessorFn: (row) => row.customer.name,
    header: "Müşteri",
    cell: ({ row }) => (
      <Link href={`/yonetim/musteriler/${row.original.customer.id}`} className="font-medium hover:underline">
        {row.original.customer.name}
      </Link>
    ),
  },
  {
    accessorKey: "to",
    header: "Alıcı",
    cell: ({ row }) => (
      <span className="font-mono text-xs">
        {CHANNEL_LABEL[row.original.channel] ?? row.original.channel} · {row.original.to}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Durum",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="space-y-0.5">
        <StatusBadge kind="broadcastRecipient" status={row.original.status} />
        {row.original.error ? (
          <p className="max-w-xs truncate text-xs text-muted-foreground" title={row.original.error}>
            {ERROR_LABEL[row.original.error] ?? row.original.error}
          </p>
        ) : null}
      </div>
    ),
  },
  {
    id: "updated",
    accessorFn: (row) => row.sentAt ?? row.updatedAt,
    header: "Zaman",
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatDateTime(row.original.sentAt ?? row.original.updatedAt)}
        {row.original.attempt > 0 ? <span className="block text-xs">{row.original.attempt + 1}. deneme</span> : null}
      </span>
    ),
  },
  {
    id: "log",
    header: "",
    enableSorting: false,
    cell: ({ row }) =>
      row.original.notificationLogId ? (
        <Link href={`/yonetim/bildirimler/${row.original.notificationLogId}`} className="text-xs text-muted-foreground underline underline-offset-2">
          Kayıt
        </Link>
      ) : null,
  },
];

export function BroadcastDetail({
  broadcast,
  counts: initialCounts,
  preview,
  recipients,
  recipientLimit,
}: {
  broadcast: Broadcast;
  counts: RecipientCounts;
  preview: { subject: string; html: string; sms: string | null } | null;
  recipients: Recipient[];
  recipientLimit: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [counts, setCounts] = useState(initialCounts);
  const [status, setStatus] = useState(broadcast.status);
  const [scheduleAt, setScheduleAt] = useState("");

  useEffect(() => {
    setCounts(initialCounts);
    setStatus(broadcast.status);
  }, [initialCounts, broadcast.status]);

  // Live progress while the broadcast is scheduled or sending.
  useEffect(() => {
    if (!ACTIVE.has(status)) return;
    const timer = setInterval(async () => {
      const result = await getBroadcastProgressAction(broadcast.id);
      if (!result.success) return;
      setCounts(result.data.counts);
      if (result.data.status !== status) {
        setStatus(result.data.status);
        router.refresh();
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [broadcast.id, status, router]);

  const run = (fn: () => Promise<{ success: boolean; error?: string }>, ok: string) =>
    start(async () => {
      const result = await fn();
      if (!result.success) {
        toast.error(result.error ?? "İşlem başarısız");
        return;
      }
      toast.success(ok);
      router.refresh();
    });

  const cancel = () => {
    if (!window.confirm("Gönderim durdurulsun mu? Henüz gönderilmemiş mesajlar iptal edilir; gönderilmiş olanlar geri alınamaz.")) return;
    run(() => cancelBroadcastAction(broadcast.id), "Duyuru iptal edildi");
  };
  const resend = () => {
    if (!window.confirm(`${counts.FAILED} başarısız mesaj yeniden gönderilsin mi?`)) return;
    run(() => resendFailedBroadcastAction(broadcast.id), "Başarısız mesajlar yeniden sıraya alındı");
  };
  const startNow = () => {
    if (!window.confirm("Taslak şimdi gönderilsin mi? Alıcı listesi gönderim başlarken oluşturulur.")) return;
    run(() => startBroadcastAction(broadcast.id, null), "Gönderim başladı");
  };
  const schedule = () => {
    const iso = fromLocalInput(scheduleAt);
    if (!iso) {
      toast.error("Gönderim zamanını seçin");
      return;
    }
    run(() => startBroadcastAction(broadcast.id, iso), "Duyuru zamanlandı");
  };
  const remove = () => {
    if (!window.confirm("Taslak silinsin mi?")) return;
    start(async () => {
      const result = await deleteBroadcastDraftAction(broadcast.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Taslak silindi");
      router.push("/yonetim/duyurular");
    });
  };

  const done = counts.SENT + counts.FAILED + counts.SKIPPED + counts.CANCELLED;
  const percent = counts.total ? Math.round((done / counts.total) * 100) : 0;
  const inFlight = counts.PENDING + counts.QUEUED;

  return (
    <>
      <PageHeader
        back={{ href: "/yonetim/duyurular", label: "Duyurular" }}
        eyebrow={KIND_LABEL[broadcast.kind]}
        title={broadcast.subject}
        meta={<StatusBadge kind="broadcast" status={status} />}
        actions={
          <div className="flex flex-wrap gap-2">
            {ACTIVE.has(status) ? (
              <button type="button" onClick={cancel} disabled={pending} className={appButton({ variant: "destructive" })}>
                <Ban aria-hidden />
                Gönderimi iptal et
              </button>
            ) : null}
            {(status === "COMPLETED" || status === "SENDING") && counts.FAILED > 0 ? (
              <button type="button" onClick={resend} disabled={pending} className={appButton({ variant: "outline" })}>
                <RotateCcw aria-hidden />
                Başarısızları yeniden gönder ({counts.FAILED})
              </button>
            ) : null}
            {status === "DRAFT" ? (
              <>
                <button type="button" onClick={remove} disabled={pending} className={appButton({ variant: "outline" })}>
                  <Trash2 aria-hidden />
                  Sil
                </button>
                <button type="button" onClick={startNow} disabled={pending} className={appButton()}>
                  {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Send aria-hidden />}
                  Şimdi gönder
                </button>
              </>
            ) : null}
          </div>
        }
      />

      <StatGrid columns={4}>
        <StatCard label="Alıcı" value={counts.total.toLocaleString("tr-TR")} hint={status === "SCHEDULED" ? "Liste gönderim başlarken oluşur" : `%${percent} tamamlandı`} />
        <StatCard label="Gönderildi" value={counts.SENT.toLocaleString("tr-TR")} tone={counts.SENT ? "success" : undefined} hint="Sağlayıcıya teslim edildi" />
        <StatCard label="Bekliyor" value={inFlight.toLocaleString("tr-TR")} tone={inFlight && ACTIVE.has(status) ? "info" : undefined} hint={`${counts.QUEUED} kuyrukta · ${counts.PENDING} sırada`} />
        <StatCard
          label="Başarısız"
          value={counts.FAILED.toLocaleString("tr-TR")}
          tone={counts.FAILED ? "danger" : undefined}
          hint={`${counts.SKIPPED} atlandı · ${counts.CANCELLED} iptal`}
        />
      </StatGrid>

      {counts.total > 0 ? (
        <div className="space-y-1.5" aria-label="Gönderim ilerlemesi">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-foreground transition-[width]" style={{ width: `${percent}%` }} />
          </div>
          {ACTIVE.has(status) ? <p className="text-xs text-muted-foreground">Sayfa her 5 saniyede güncellenir.</p> : null}
        </div>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <SectionCard
            title="Alıcılar"
            description={counts.total > recipientLimit ? `Son güncellenen ${recipientLimit} alıcı gösteriliyor.` : undefined}
            flush
          >
            <DataTable
              framed={false}
              columns={columns}
              data={recipients}
              searchFn={(row, q) => row.customer.name.toLocaleLowerCase("tr-TR").includes(q) || row.to.toLocaleLowerCase("tr-TR").includes(q)}
              searchPlaceholder="Müşteri veya adres ara…"
              filters={[
                { id: "status", label: "Durum", options: getStatusOptions("broadcastRecipient"), getValue: (row) => row.status, variant: "select" },
              ]}
              initialSort={[{ id: "updated", desc: true }]}
              pageSize={25}
              mobileCard={(row) => (
                <ListRow
                  title={row.customer.name}
                  subtitle={`${CHANNEL_LABEL[row.channel] ?? row.channel} · ${row.to}`}
                  meta={<StatusBadge kind="broadcastRecipient" status={row.status} />}
                  trailing={row.error ? <span className="text-xs text-muted-foreground">{ERROR_LABEL[row.error] ?? row.error}</span> : undefined}
                />
              )}
              emptyState={
                <p className="px-5 py-6 text-sm text-muted-foreground">
                  {status === "DRAFT" || status === "SCHEDULED" ? "Alıcı listesi gönderim başladığında oluşturulur." : "Alıcı yok."}
                </p>
              }
            />
          </SectionCard>

          <SectionCard title="İçerik" description={preview ? `Konu: ${preview.subject} (sizin bilgilerinizle)` : undefined} flush>
            {preview ? (
              <>
                <iframe title="E-posta önizleme" srcDoc={preview.html} sandbox="" className="block h-[620px] w-full border-0 bg-[#f4f4f5]" />
                {preview.sms ? (
                  <div className="border-t px-5 py-4">
                    <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">SMS</p>
                    <p className="font-mono text-xs leading-relaxed">{preview.sms}</p>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="px-5 py-4 text-sm text-muted-foreground">Önizleme oluşturulamadı.</p>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Özet">
            <DetailList
              items={[
                { label: "Hedef kitle", value: broadcast.audience },
                { label: "Kanallar", value: broadcast.channels.map((c) => CHANNEL_LABEL[c] ?? c).join(" + ") },
                { label: "Oluşturan", value: broadcast.createdBy },
                { label: "Oluşturma", value: formatDateTime(broadcast.createdAt) },
                { label: "Zamanlama", value: broadcast.scheduledAt ? formatDateTime(broadcast.scheduledAt) : "", hideEmpty: true },
                { label: "Başlangıç", value: broadcast.startedAt ? formatDateTime(broadcast.startedAt) : "", hideEmpty: true },
                { label: "Bitiş", value: broadcast.completedAt ? formatDateTime(broadcast.completedAt) : "", hideEmpty: true },
                { label: "İptal", value: broadcast.cancelledAt ? formatDateTime(broadcast.cancelledAt) : "", hideEmpty: true },
              ]}
            />
            {broadcast.incident ? (
              <p className="mt-4 text-sm">
                Durum sayfası olayı:{" "}
                <Link href={`/yonetim/durum/olaylar/${broadcast.incident.id}`} className="underline underline-offset-2">
                  {broadcast.incident.title}
                </Link>
              </p>
            ) : null}
          </SectionCard>

          {status === "DRAFT" ? (
            <SectionCard title="Zamanla" description="Taslağı ileri bir tarihte göndermek için.">
              <div className="flex flex-col gap-3">
                <Input type="datetime-local" aria-label="Gönderim zamanı" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} className="h-11 md:h-10" />
                <button type="button" onClick={schedule} disabled={pending} className={appButton({ variant: "outline" })}>
                  Zamanla
                </button>
              </div>
            </SectionCard>
          ) : null}
        </div>
      </div>
    </>
  );
}
