"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { AlertTriangle, CheckCircle2, Clock, Cpu, RefreshCw, X } from "lucide-react";
import {
  DataTable,
  EmptyState,
  ListRow,
  PageHeader,
  SectionCard,
  StatCard,
  StatGrid,
  StatusBadge,
  ToneDot,
  appButton,
  getStatusOptions,
  type ColumnDef,
} from "@/components/app";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format/date";
import { cancelQueueJobAction, retryQueueJobAction } from "@/lib/actions/admin/jobs";
import { toast } from "@/lib/toast";
import type { JobsDashboard } from "@/lib/dal/jobs";

type ProblemJob = JobsDashboard["problems"][number];
type CronRunRow = JobsDashboard["cronRuns"][number];
type QueueRow = JobsDashboard["stats"][number];

function formatDuration(ms: number | null) {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} sn`;
  return `${Math.round(seconds / 60).toLocaleString("tr-TR")} dk`;
}

function ErrorDetails({ message }: { message: string }) {
  return (
    <details className="group max-w-xs">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden">
        <AlertTriangle aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-[13px]">{message}</span>
      </summary>
      <pre className="mt-2 whitespace-pre-wrap break-words rounded-md border bg-muted/40 p-2 font-mono text-xs text-muted-foreground">
        {message}
      </pre>
    </details>
  );
}

function JobActions({ job }: { job: ProblemJob }) {
  const router = useRouter();
  const [retrying, startRetry] = useTransition();
  const [cancelling, startCancel] = useTransition();
  const busy = retrying || cancelling;

  const retry = () =>
    startRetry(async () => {
      const result = await retryQueueJobAction(job.name, job.id);
      if (result.success) toast.success(result.message);
      else toast.error(result.error);
      router.refresh();
    });

  const cancel = () => {
    const question =
      job.state === "failed"
        ? "Bu başarısız iş listeden kaldırılsın mı?"
        : "Bu iş iptal edilsin mi? Bir daha denenmeyecek.";
    if (!window.confirm(question)) return;
    startCancel(async () => {
      const result = await cancelQueueJobAction(job.name, job.id);
      if (result.success) toast.success(result.message);
      else toast.error(result.error);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap justify-end gap-2">
      {job.state === "failed" ? (
        <button type="button" onClick={retry} disabled={busy} className={appButton({ variant: "outline", size: "sm" })}>
          <RefreshCw aria-hidden className={cn(retrying && "animate-spin")} />
          {retrying ? "Deneniyor…" : "Yeniden dene"}
        </button>
      ) : null}
      <button type="button" onClick={cancel} disabled={busy} className={appButton({ variant: "ghost", size: "sm" })}>
        <X aria-hidden />
        İptal
      </button>
    </div>
  );
}

function attemptLabel(job: ProblemJob) {
  return `${job.retryCount + 1}/${Math.max(job.retryLimit, job.retryCount) + 1}`;
}

const problemColumns: ColumnDef<ProblemJob>[] = [
  {
    id: "job",
    accessorFn: (j) => j.label,
    header: "İş",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="font-medium">{row.original.label}</p>
        <p className="max-w-[260px] truncate font-mono text-xs text-muted-foreground" title={row.original.dataPreview}>
          {row.original.dataPreview || row.original.id}
        </p>
      </div>
    ),
  },
  {
    accessorKey: "state",
    header: "Durum",
    enableSorting: false,
    cell: ({ row }) => <StatusBadge kind="queueJob" status={row.original.state} />,
  },
  {
    id: "attempts",
    accessorFn: (j) => j.retryCount,
    header: "Deneme",
    meta: { align: "right" },
    cell: ({ row }) => <span className="font-mono text-xs tabular-nums">{attemptLabel(row.original)}</span>,
  },
  {
    id: "error",
    header: "Hata",
    enableSorting: false,
    cell: ({ row }) =>
      row.original.error ? <ErrorDetails message={row.original.error} /> : <span className="text-muted-foreground">—</span>,
  },
  {
    id: "when",
    accessorFn: (j) => new Date(j.completedOn ?? j.startAfter).getTime(),
    header: "Zaman",
    cell: ({ row }) => (
      <span className="whitespace-nowrap tabular-nums text-muted-foreground">
        {row.original.state === "retry"
          ? `Sonraki: ${formatDateTime(row.original.startAfter)}`
          : formatDateTime(row.original.completedOn)}
      </span>
    ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">İşlemler</span>,
    enableSorting: false,
    meta: { align: "right", className: "w-px" },
    cell: ({ row }) => <JobActions job={row.original} />,
  },
];

const queueColumns: ColumnDef<QueueRow>[] = [
  {
    accessorKey: "label",
    header: "Kuyruk",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="font-medium">{row.original.label}</p>
        <p className="font-mono text-xs text-muted-foreground">{row.original.name}</p>
      </div>
    ),
  },
  ...(
    [
      ["created", "Sırada"],
      ["retry", "Yeniden denenecek"],
      ["active", "Çalışıyor"],
      ["completed", "Tamamlanan"],
      ["failed", "Başarısız"],
    ] as const
  ).map(
    ([key, header]): ColumnDef<QueueRow> => ({
      accessorKey: key,
      header,
      meta: { align: "right" },
      cell: ({ row }) => <span className="tabular-nums">{row.original[key].toLocaleString("tr-TR")}</span>,
    })
  ),
];

const cronColumns: ColumnDef<CronRunRow>[] = [
  {
    accessorKey: "label",
    header: "Görev",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="font-medium">{row.original.label}</p>
        <p className="font-mono text-xs text-muted-foreground">{row.original.job}</p>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Durum",
    enableSorting: false,
    cell: ({ row }) => <StatusBadge kind="cronRun" status={row.original.status} />,
  },
  {
    id: "startedAt",
    accessorFn: (r) => new Date(r.startedAt).getTime(),
    header: "Başlangıç",
    cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{formatDateTime(row.original.startedAt)}</span>,
  },
  {
    accessorKey: "durationMs",
    header: "Süre",
    meta: { align: "right" },
    cell: ({ row }) => <span className="tabular-nums text-muted-foreground">{formatDuration(row.original.durationMs)}</span>,
  },
  {
    id: "detail",
    header: "Özet",
    enableSorting: false,
    cell: ({ row }) =>
      row.original.error ? (
        <ErrorDetails message={row.original.error} />
      ) : (
        <span className="block max-w-[320px] truncate font-mono text-xs text-muted-foreground" title={row.original.summary ?? ""}>
          {row.original.summary ?? "—"}
        </span>
      ),
  },
];

export function IslerContent({ queueAvailable, stats, problems, cronRuns, workers }: JobsDashboard) {
  const totals = stats.reduce(
    (acc, q) => ({
      created: acc.created + q.created,
      retry: acc.retry + q.retry,
      active: acc.active + q.active,
      failed: acc.failed + q.failed,
    }),
    { created: 0, retry: 0, active: 0, failed: 0 }
  );
  const liveWorkers = workers.filter((w) => w.fresh);

  return (
    <>
      <PageHeader
        title="Arka plan işleri"
        description="İş kuyruğu (pg-boss), başarısız işler ve zamanlanmış görevlerin çalışma geçmişi."
        actions={
          <Link href="/yonetim/provisioning" className={appButton({ variant: "outline" })}>
            <RefreshCw aria-hidden />
            Provisioning kuyruğu
          </Link>
        }
      />

      <StatGrid columns={4}>
        <StatCard
          label="Başarısız"
          value={totals.failed.toLocaleString("tr-TR")}
          hint={totals.failed ? "Müdahale gerekiyor" : "Başarısız iş yok"}
          tone={totals.failed ? "danger" : undefined}
        />
        <StatCard
          label="Yeniden denenecek"
          value={totals.retry.toLocaleString("tr-TR")}
          hint="Bekleme süresinden sonra tekrar denenecek"
          tone={totals.retry ? "warning" : undefined}
        />
        <StatCard
          label="Sırada / çalışıyor"
          value={`${totals.created.toLocaleString("tr-TR")} / ${totals.active.toLocaleString("tr-TR")}`}
          hint="Bekleyen ve şu anda işlenen"
        />
        <StatCard
          label="İşçi"
          value={liveWorkers.length ? "Aktif" : "Boşta"}
          hint={liveWorkers.length ? `${liveWorkers.length} işçi son dakikalarda çalıştı` : "Son dakikalarda çalışan işçi yok"}
          tone={liveWorkers.length ? "success" : "warning"}
        />
      </StatGrid>

      {!queueAvailable ? (
        <EmptyState
          icon={AlertTriangle}
          title="İş kuyruğuna ulaşılamadı"
          description="pg-boss başlatılamadı. Veritabanı bağlantısını ve uygulama loglarını kontrol edin."
        />
      ) : (
        <>
          <SectionCard
            title="Sorunlu işler"
            description="Tüm denemeleri tükenmiş (başarısız) veya hata alıp yeniden denenmeyi bekleyen işler."
            flush
          >
            <DataTable
              caption="Sorunlu işler"
              framed={false}
              columns={problemColumns}
              data={problems}
              getRowId={(j) => j.id}
              initialSort={[{ id: "when", desc: true }]}
              filters={[
                {
                  id: "state",
                  label: "Durum",
                  options: getStatusOptions("queueJob").filter((o) => o.value === "failed" || o.value === "retry"),
                  getValue: (j) => j.state,
                },
              ]}
              searchFn={(j, q) =>
                j.label.toLocaleLowerCase("tr-TR").includes(q) ||
                j.dataPreview.toLocaleLowerCase("tr-TR").includes(q) ||
                (j.error ?? "").toLocaleLowerCase("tr-TR").includes(q)
              }
              searchPlaceholder="İş, veri veya hata ara…"
              mobileCard={(j) => (
                <div className="space-y-3">
                  <ListRow
                    title={j.label}
                    subtitle={<span className="font-mono text-xs">{j.dataPreview || j.id}</span>}
                    trailing={<span className="font-mono text-xs font-normal text-muted-foreground">{attemptLabel(j)} deneme</span>}
                    meta={
                      <>
                        <StatusBadge kind="queueJob" status={j.state} />
                        <span className="tabular-nums">{formatDateTime(j.completedOn ?? j.startAfter)}</span>
                      </>
                    }
                  />
                  {j.error ? <ErrorDetails message={j.error} /> : null}
                  <JobActions job={j} />
                </div>
              )}
              emptyState={
                <EmptyState icon={CheckCircle2} title="Sorunlu iş yok" description="Kuyruktaki tüm işler sorunsuz işleniyor." compact />
              }
            />
          </SectionCard>

          <SectionCard title="Kuyruklar" description="pg-boss tablosundaki işlerin duruma göre dağılımı." flush>
            <DataTable
              caption="Kuyruk istatistikleri"
              framed={false}
              columns={queueColumns}
              data={stats}
              getRowId={(q) => q.name}
              pageSize={0}
              mobileCard={(q) => (
                <ListRow
                  title={q.label}
                  subtitle={<span className="font-mono text-xs">{q.name}</span>}
                  meta={
                    <span className="tabular-nums">
                      Sırada {q.created} · Yeniden {q.retry} · Çalışıyor {q.active} · Tamamlanan {q.completed} · Başarısız {q.failed}
                    </span>
                  }
                />
              )}
              emptyState={<EmptyState icon={Clock} title="Kayıtlı kuyruk yok" compact />}
            />
          </SectionCard>
        </>
      )}

      <SectionCard
        title="İşçiler"
        description="Kuyruğu işleyen süreçlerin son yoklaması. “drain”, dakikalık cron üzerinden uygulama içinde çalışır."
      >
        {workers.length ? (
          <ul className="divide-y">
            {workers.map((w) => (
              <li key={w.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-2">
                  <ToneDot tone={w.fresh ? "success" : "warning"} />
                  <span className="truncate font-mono text-[13px]">{w.id}</span>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  Son yoklama: {formatDateTime(w.lastSeenAt)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={Cpu}
            title="Henüz çalışan işçi yok"
            description="Dakikalık “jobs-drain” zamanlanmış görevini veya ayrı işçi servisini kurun (docs/ops-jobs.md)."
            compact
          />
        )}
      </SectionCard>

      <SectionCard title="Zamanlanmış görev geçmişi" description="Son 60 çalıştırma. Aynı görev aynı anda iki kez çalışmaz; ikinci çağrı “kilitli” olarak kaydedilir." flush>
        <DataTable
          caption="Zamanlanmış görev geçmişi"
          framed={false}
          columns={cronColumns}
          data={cronRuns}
          getRowId={(r) => r.id}
          initialSort={[{ id: "startedAt", desc: true }]}
          filters={[{ id: "status", label: "Durum", options: getStatusOptions("cronRun"), getValue: (r) => r.status }]}
          searchFn={(r, q) => r.label.toLocaleLowerCase("tr-TR").includes(q) || r.job.includes(q)}
          searchPlaceholder="Görev ara…"
          mobileCard={(r) => (
            <div className="space-y-2">
              <ListRow
                title={r.label}
                subtitle={<span className="font-mono text-xs">{r.job}</span>}
                trailing={<span className="text-xs font-normal tabular-nums text-muted-foreground">{formatDuration(r.durationMs)}</span>}
                meta={
                  <>
                    <StatusBadge kind="cronRun" status={r.status} />
                    <span className="tabular-nums">{formatDateTime(r.startedAt)}</span>
                  </>
                }
              />
              {r.error ? <ErrorDetails message={r.error} /> : null}
            </div>
          )}
          emptyState={<EmptyState icon={Clock} title="Henüz kayıtlı çalıştırma yok" compact />}
        />
      </SectionCard>
    </>
  );
}
