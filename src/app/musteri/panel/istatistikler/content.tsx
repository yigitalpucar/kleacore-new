import Link from "next/link";
import { Activity, ArrowUpRight, HardDrive, Package, Wallet, Wifi } from "lucide-react";
import {
  ChartCard,
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  StatGrid,
  StatusBadge,
  UsageMeter,
  appButton,
} from "@/components/app";
import { formatTRY } from "@/lib/format/price";
import { RefreshButton } from "./refresh-button";
import { PanelEmptyState } from "@/components/panel/panel-empty-state";

type Pair = { used: number | null; total: number | null };

interface ServiceUsageItem {
  id: string;
  name: string;
  label: string | null;
  domain: string | null;
  disk: Pair;
  bandwidth: Pair;
  cpu: number | null;
  ram: number | null;
  status: string;
}

interface IstatistiklerContentProps {
  serviceUsage: ServiceUsageItem[];
  totals: {
    services: number;
    activeServices: number;
    disk: { used: number; total: number; count: number };
    bandwidth: { used: number; total: number; count: number };
    paidTotal: number;
    paidCount: number;
  };
  monthlyPayments: { label: string; longLabel: string; value: number }[];
}

const gb = (n: number) => `${n.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} GB`;
const pct = (used: number, total: number) => (total > 0 ? Math.round((used / total) * 100) : 0);
const hasPair = (p: Pair) => p.used !== null && p.total !== null && p.total > 0;
const hasMetrics = (s: ServiceUsageItem) => hasPair(s.disk) || hasPair(s.bandwidth) || s.cpu !== null || s.ram !== null;

export function IstatistiklerContent({ serviceUsage, totals, monthlyPayments }: IstatistiklerContentProps) {
  const withMetrics = serviceUsage.filter(hasMetrics);
  const withoutMetrics = serviceUsage.length - withMetrics.length;
  const diskPct = pct(totals.disk.used, totals.disk.total);
  const bwPct = pct(totals.bandwidth.used, totals.bandwidth.total);
  const tone = (p: number) => (p >= 90 ? "danger" : p >= 70 ? "warning" : undefined);

  return (
    <>
      <PageHeader
        title="İstatistikler"
        description="Hizmetlerinizin kaynak kullanımı ve son 12 aydaki ödemeleriniz."
        actions={<RefreshButton />}
      />

      <StatGrid columns={4}>
        <StatCard
          label="Aktif hizmet"
          icon={Package}
          value={totals.activeServices}
          hint={totals.services ? `Toplam ${totals.services} hizmet` : "Henüz hizmetiniz yok"}
        />
        <StatCard
          label="Disk"
          icon={HardDrive}
          value={totals.disk.count ? gb(totals.disk.used) : "—"}
          hint={totals.disk.count ? `${gb(totals.disk.total)} kotanın %${diskPct}'i` : "Kullanım verisi yok"}
          tone={totals.disk.count ? tone(diskPct) : undefined}
        />
        <StatCard
          label="Bant genişliği"
          icon={Wifi}
          value={totals.bandwidth.count ? gb(totals.bandwidth.used) : "—"}
          hint={totals.bandwidth.count ? `${gb(totals.bandwidth.total)} kotanın %${bwPct}'i` : "Kullanım verisi yok"}
          tone={totals.bandwidth.count ? tone(bwPct) : undefined}
        />
        <StatCard
          label="Ödenen · 12 ay"
          icon={Wallet}
          value={formatTRY(totals.paidTotal, { keepDecimals: true })}
          hint={totals.paidCount ? `${totals.paidCount} ödenmiş fatura` : "Bu dönemde ödeme yok"}
          href="/musteri/panel/faturalar"
        />
      </StatGrid>

      <ChartCard
        title="Aylık ödemeler"
        description="Son 12 ayda ödenen faturaların ödeme ayına göre toplamı."
        data={monthlyPayments.map((m) => ({ label: m.label, value: m.value }))}
        formatValue={(n) => formatTRY(n, { keepDecimals: true })}
        emptyText="Son 12 ayda ödenmiş faturanız yok."
        actions={
          <Link href="/musteri/panel/faturalar" className={appButton({ variant: "ghost", size: "sm" })}>
            Faturalar
            <ArrowUpRight aria-hidden />
          </Link>
        }
      />

      <SectionCard
        title="Hizmet bazında kaynak kullanımı"
        description="Değerler hizmet kayıtlarındaki son ölçümlerdir; anlık olmayabilir."
        flush
      >
        {serviceUsage.length === 0 ? (
          <div className="p-4 md:p-5">
            <PanelEmptyState kind="usage" compact />
          </div>
        ) : withMetrics.length === 0 ? (
          <div className="p-4 md:p-5">
            <EmptyState
              compact
              icon={Activity}
              title="Kullanım verisi yok"
              description="Hizmetleriniz için henüz disk, trafik veya işlemci ölçümü kaydedilmedi."
            />
          </div>
        ) : (
          <ul className="divide-y">
            {withMetrics.map((s) => (
              <li key={s.id} className="space-y-4 px-4 py-4 md:px-5">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <Link
                      href={`/musteri/panel/hizmetlerim/${s.id}`}
                      className="text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {s.label || s.name}
                    </Link>
                    <p className="truncate text-[13px] text-muted-foreground">
                      {s.label ? s.name : null}
                      {s.label && s.domain ? " · " : null}
                      {s.domain ? <span className="font-mono text-xs">{s.domain}</span> : null}
                    </p>
                  </div>
                  <StatusBadge kind="service" status={s.status} />
                </div>
                <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
                  {hasPair(s.disk) ? (
                    <UsageMeter label="Disk" used={s.disk.used} limit={s.disk.total} unit="GB" />
                  ) : null}
                  {hasPair(s.bandwidth) ? (
                    <UsageMeter
                      label="Bant genişliği"
                      used={s.bandwidth.used}
                      limit={s.bandwidth.total}
                      unit="GB"
                    />
                  ) : null}
                  {s.cpu !== null ? <UsageMeter label="İşlemci" percent={s.cpu} /> : null}
                  {s.ram !== null ? <UsageMeter label="Bellek" percent={s.ram} /> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        {withMetrics.length > 0 && withoutMetrics > 0 ? (
          <p className="border-t border-dashed px-4 py-3 text-[13px] text-muted-foreground md:px-5">
            {withoutMetrics} hizmet için kullanım verisi bulunmuyor.
          </p>
        ) : null}
      </SectionCard>
    </>
  );
}
