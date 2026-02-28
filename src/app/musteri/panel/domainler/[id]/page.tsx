import { notFound } from "next/navigation";
import { getDomainWithDns } from "@/lib/dal/domains";
import { DomainDetayContent } from "./content";

interface DomainDetayPageProps {
  params: Promise<{ id: string }>;
}

export default async function DomainDetayPage(props: DomainDetayPageProps) {
  const params = await props.params;
  const domain = await getDomainWithDns(params.id);

  if (!domain) {
    notFound();
  }

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
    })),
  };

  return <DomainDetayContent domain={serializedDomain} />;
}
