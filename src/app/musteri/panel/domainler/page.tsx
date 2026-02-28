import { auth } from "@/lib/auth";
import { getDomainsByCustomer } from "@/lib/dal/domains";
import { DomainlerContent } from "./content";

export default async function DomainlerPage() {
  const session = await auth();
  const domains = await getDomainsByCustomer(session!.user.id);

  const serializedDomains = domains.map((d) => ({
    id: d.id,
    name: d.name,
    registrar: d.registrar,
    status: d.status,
    autoRenew: d.autoRenew,
    privacyEnabled: d.privacyEnabled,
    hasSsl: false,
    registeredAt: d.registeredAt.toISOString(),
    expiresAt: d.expiresAt.toISOString(),
    nameservers: (d.nameservers as string[]) ?? [],
  }));

  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;

  const stats = {
    total: domains.length,
    active: domains.filter((d) => d.status === "ACTIVE").length,
    expiring: domains.filter((d) => {
      const timeLeft = d.expiresAt.getTime() - now;
      return d.status === "ACTIVE" && timeLeft > 0 && timeLeft <= thirtyDays;
    }).length,
  };

  return <DomainlerContent domains={serializedDomains} stats={stats} />;
}
