import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDomainWithDns } from "@/lib/dal/domains";
import { DomainDetayContent } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Alan adı detayı" };

interface DomainDetayPageProps {
  params: Promise<{ id: string }>;
}

export default async function DomainDetayPage(props: DomainDetayPageProps) {
  const params = await props.params;
  const session = await auth();
  const domain = await getDomainWithDns(params.id);

  if (!domain || domain.customerId !== session!.user.id) {
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
