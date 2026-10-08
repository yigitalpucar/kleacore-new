import type { Metadata } from "next";
import Link from "next/link";
import { Gauge } from "lucide-react";
import { EmptyState, PageHeader, SectionCard, StatusBadge, UsageMeter } from "@/components/app";
import { formatDateTime } from "@/lib/format/date";
import { listOverQuotaServices } from "@/lib/services/usage-sync";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Kota aşımı" };

/**
 * Hosting accounts at or over their disk / bandwidth quota, from the daily
 * panel usage sync (hosting.usage-sync). Bandwidth is the current month.
 */
export default async function OverQuotaServicesPage() {
  const services = await listOverQuotaServices();

  return (
    <>
      <PageHeader
        title="Kota aşımı"
        description="Disk veya bu ayki bant genişliği kotasını dolduran hosting hesapları. Veriler her gece cPanel/WHM'den güncellenir."
      />
      <SectionCard flush title={`${services.length} hesap`}>
        {services.length ? (
          <ul className="divide-y">
            {services.map((service) => {
              const customer = `${service.customer.name} ${service.customer.surname}`.trim() || service.customer.email;
              return (
                <li key={service.id} className="grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:px-5">
                  <div className="min-w-0 space-y-1 text-sm">
                    <Link href={`/yonetim/hizmetler/${service.id}`} className="block truncate font-medium hover:underline">
                      {service.domain || service.label || service.product.name}
                    </Link>
                    <p className="truncate text-muted-foreground">
                      {customer} · {service.product.name}
                      {service.remoteId ? <span className="font-mono"> · {service.remoteId}</span> : null}
                    </p>
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <StatusBadge kind="service" status={service.status} />
                      {service.moduleInstance ? <span>{service.moduleInstance.label}</span> : null}
                      {service.usageSyncedAt ? <span>Güncelleme {formatDateTime(service.usageSyncedAt)}</span> : null}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(service.diskLimit ?? 0) > 0 ? (
                      <UsageMeter label="Disk" used={service.diskUsed ?? 0} limit={service.diskLimit} unit="GB" />
                    ) : null}
                    {(service.bandwidthLimit ?? 0) > 0 ? (
                      <UsageMeter label="Bant genişliği (bu ay)" used={service.bandwidthUsed ?? 0} limit={service.bandwidthLimit} unit="GB" />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="p-4">
            <EmptyState
              compact
              icon={Gauge}
              title="Kotasını aşan hesap yok"
              description="Kullanım senkronu çalıştığında kotasını dolduran hesaplar burada listelenir."
            />
          </div>
        )}
      </SectionCard>
    </>
  );
}
