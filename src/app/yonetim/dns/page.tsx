import type { Metadata } from "next";
import { db } from "@/lib/db";
import { DNS_HOSTING_IP_SETTING, getDnsDefaultProvider } from "@/lib/dns/settings";
import { getSettingValue } from "@/lib/integrations/settings";
import { listActiveInstances } from "@/lib/modules/instances";
import { AdminDnsContent, type ZoneRow } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "DNS bölgeleri" };

export default async function AdminDnsPage() {
  const [zones, provider, hostingIp, instances] = await Promise.all([
    db.dnsZone.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        domain: {
          select: {
            id: true,
            name: true,
            nameservers: true,
            customer: { select: { name: true, surname: true, email: true } },
            _count: { select: { dnsRecords: true } },
          },
        },
        moduleInstance: { select: { label: true } },
      },
    }),
    getDnsDefaultProvider(),
    getSettingValue(DNS_HOSTING_IP_SETTING, "DNS_HOSTING_IP"),
    listActiveInstances("dns"),
  ]);

  const rows: ZoneRow[] = zones.map((zone) => ({
    id: zone.id,
    domainId: zone.domain.id,
    domain: zone.domain.name,
    customer:
      [zone.domain.customer.name, zone.domain.customer.surname].filter(Boolean).join(" ") || zone.domain.customer.email,
    status: zone.status,
    nameservers: zone.nameservers,
    recordCount: zone.domain._count.dnsRecords,
    instance: zone.moduleInstance?.label ?? null,
    lastSyncedAt: zone.lastSyncedAt?.toISOString() ?? null,
    lastError: zone.lastError,
  }));

  return (
    <AdminDnsContent
      zones={rows}
      settings={{ provider, hostingIp }}
      instances={instances.map((instance) => ({ id: instance.id, label: instance.label }))}
    />
  );
}
