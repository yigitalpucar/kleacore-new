import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getCurrentDomainRenewal, getDomainWithDns } from "@/lib/dal/domains";
import { getDnsDefaultProvider } from "@/lib/dns/settings";
import { isRegisteredThroughUs, nameserversMatch, refreshZoneMirrorIfStale } from "@/lib/dns/zones";
import { DomainDetayContent } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Alan adı detayı" };

interface DomainDetayPageProps {
  params: Promise<{ id: string }>;
}

export default async function DomainDetayPage(props: DomainDetayPageProps) {
  const params = await props.params;
  const session = await auth();
  const owned = await getDomainWithDns(params.id);

  if (!owned || owned.customerId !== session!.user.id) {
    notFound();
  }

  // Cloudflare zones: re-read the records when the local mirror is stale.
  const dnsSyncError = owned.dnsZone ? await refreshZoneMirrorIfStale(owned.id) : null;
  const domain = owned.dnsZone ? ((await getDomainWithDns(owned.id)) ?? owned) : owned;
  const dnsProvider = await getDnsDefaultProvider();

  const renewal = await getCurrentDomainRenewal(domain.id, domain.expiresAt);

  const serializedDomain = {
    id: domain.id,
    name: domain.name,
    registrar: domain.registrar,
    status: domain.status,
    autoRenew: domain.autoRenew,
    privacyEnabled: domain.privacyEnabled,
    registeredAt: domain.registeredAt.toISOString(),
    expiresAt: domain.expiresAt.toISOString(),
    nameservers: (domain.nameservers as string[]) ?? [],
    whoisName: domain.whoisName,
    whoisEmail: domain.whoisEmail,
    whoisPhone: domain.whoisPhone,
    whoisAddress: domain.whoisAddress,
    dnsRecords: domain.dnsRecords.map((r) => ({
      id: r.id,
      type: r.type,
      name: r.name,
      value: r.value,
      ttl: r.ttl,
      priority: r.priority,
      proxied: r.proxied,
      managed: Boolean(r.managedBy),
    })),
  };

  const zone = domain.dnsZone;
  const dns = {
    mode: zone ? ("cloudflare" as const) : ("registrar" as const),
    canEnableCloudflare: !zone && dnsProvider === "cloudflare",
    zone: zone
      ? {
          status: zone.status,
          nameservers: zone.nameservers,
          lastSyncedAt: zone.lastSyncedAt?.toISOString() ?? null,
          nameserversPointed: nameserversMatch(domain.nameservers, zone.nameservers),
        }
      : null,
    canSwitchNameservers: Boolean(zone) && isRegisteredThroughUs(domain.registrar) && domain.status === "ACTIVE",
    syncError: dnsSyncError,
  };

  return (
    <DomainDetayContent
      domain={serializedDomain}
      dns={dns}
      renewal={
        renewal
          ? {
              status: renewal.status,
              invoiceId: renewal.invoice?.id ?? null,
              invoiceNumber: renewal.invoice?.invoiceNumber ?? null,
              invoiceStatus: renewal.invoice?.status ?? null,
            }
          : null
      }
    />
  );
}
