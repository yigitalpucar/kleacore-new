import type { Metadata } from "next";
import Link from "next/link";
import { FileLock2 } from "lucide-react";
import { EmptyState, PageHeader, SectionCard, StatCard, StatGrid, StatusBadge, appButton } from "@/components/app";
import { getDataRequestQueue, type DataRequestFilter } from "@/lib/dal/privacy";
import { formatDate, formatDateTime } from "@/lib/format/date";
import {
  DATA_REQUEST_STATUS_TONES,
  dataRequestStatusLabel,
  dataRequestTypeLabel,
  deadlineState,
  type DataRequestStatusValue,
} from "@/lib/privacy/labels";
import { cn } from "@/lib/utils";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "KVKK talepleri" };

const TABS: { value: DataRequestFilter; label: string }[] = [
  { value: "open", label: "Açık" },
  { value: "pending", label: "Doğrulama bekleyen" },
  { value: "closed", label: "Kapanan" },
  { value: "all", label: "Tümü" },
];

export default async function KvkkTalepleriPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("privacy.manage");
  const sp = await searchParams;
  const requested = typeof sp.durum === "string" ? sp.durum : "open";
  const filter: DataRequestFilter = TABS.some((tab) => tab.value === requested) ? (requested as DataRequestFilter) : "open";
  const now = new Date();
  const queue = await getDataRequestQueue(filter, now);

  return (
    <>
      <PageHeader
        title="KVKK talepleri"
        description="Veri sahibi başvuruları (KVKK m.11). Yasal yanıt süresi başvurunun alındığı andan itibaren 30 gündür; süreye göre sıralanır."
        actions={
          <Link href="/yasal/kvkk-basvuru" className={appButton({ variant: "outline" })} target="_blank">
            Başvuru formu
          </Link>
        }
      />

      <StatGrid columns={3}>
        <StatCard label="Açık" value={queue.counts.open.toLocaleString("tr-TR")} tone={queue.counts.open > 0 ? "warning" : undefined} />
        <StatCard
          label="Süresi geçen"
          value={queue.counts.overdue.toLocaleString("tr-TR")}
          tone={queue.counts.overdue > 0 ? "danger" : undefined}
        />
        <StatCard label="Doğrulama bekleyen" value={queue.counts.pending.toLocaleString("tr-TR")} />
      </StatGrid>

      <nav aria-label="Başvuru durumu" className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/yonetim/kvkk-talepleri?durum=${tab.value}`}
            aria-current={tab.value === filter ? "page" : undefined}
            className={cn(appButton({ variant: tab.value === filter ? "secondary" : "ghost", size: "sm" }))}
          >
            {tab.label}
            {tab.value !== "all" ? <span className="tabular-nums text-muted-foreground">{queue.counts[tab.value]}</span> : null}
          </Link>
        ))}
      </nav>

      <SectionCard title={TABS.find((tab) => tab.value === filter)?.label} flush>
        {queue.requests.length === 0 ? (
          <div className="p-4 md:p-5">
            <EmptyState compact icon={FileLock2} title="Başvuru yok" description="Bu durumda KVKK başvurusu bulunmuyor." />
          </div>
        ) : (
          <ul className="divide-y divide-dashed">
            {queue.requests.map((request) => {
              const deadline = deadlineState(request, now);
              return (
                <li key={request.id} className="grid gap-2 px-4 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:px-5">
                  <div className="min-w-0 space-y-1 text-sm">
                    <p className="font-medium">
                      <Link href={`/yonetim/kvkk-talepleri/${request.id}`} className="font-mono underline-offset-4 hover:underline">
                        {request.requestNumber}
                      </Link>
                      <span className="text-muted-foreground"> · {dataRequestTypeLabel(request.type)}</span>
                    </p>
                    <p className="text-muted-foreground">
                      {request.name} · <span className="font-mono text-xs">{request.email}</span>
                      {request.userId ? null : " · hesap eşleşmedi"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {request.source === "panel" ? "Panelden" : "Formdan"} · Oluşturuldu {formatDateTime(request.createdAt)}
                      {request.dueAt ? ` · Son tarih ${formatDate(request.dueAt)}` : null}
                      {request.completedAt ? ` · Kapandı ${formatDate(request.completedAt)}` : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-start gap-2 md:flex-col md:items-end">
                    <StatusBadge
                      tone={DATA_REQUEST_STATUS_TONES[request.status as DataRequestStatusValue] ?? "muted"}
                      label={dataRequestStatusLabel(request.status)}
                    />
                    {deadline.kind === "open" ? <StatusBadge tone={deadline.tone} label={deadline.label} /> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>
    </>
  );
}
