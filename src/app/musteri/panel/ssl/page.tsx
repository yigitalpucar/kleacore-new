import { auth } from "@/lib/auth";
import { getCertificatesByCustomer } from "@/lib/dal/ssl";
import { SSLContent } from "./content";

export default async function SSLPage() {
  const session = await auth();
  const certificates = await getCertificatesByCustomer(session!.user.id);

  const now = Date.now();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;

  const serializedCertificates = certificates.map((c) => {
    const expiresMs = c.expiresAt ? c.expiresAt.getTime() : 0;
    const daysLeft = c.expiresAt
      ? Math.max(0, Math.ceil((expiresMs - now) / (1000 * 60 * 60 * 24)))
      : 0;

    return {
      id: c.id,
      domain: c.domain,
      type: c.type,
      provider: c.provider,
      status: c.status,
      issuedAt: c.issuedAt ? c.issuedAt.toISOString() : null,
      expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
      autoRenew: c.autoRenew,
      daysLeft,
    };
  });

  const stats = {
    total: certificates.length,
    active: certificates.filter((c) => c.status === "ACTIVE").length,
    expiring: certificates.filter((c) => {
      if (!c.expiresAt) return false;
      const timeLeft = c.expiresAt.getTime() - now;
      return c.status === "ACTIVE" && timeLeft > 0 && timeLeft <= thirtyDays;
    }).length,
    expired: certificates.filter((c) => c.status === "EXPIRED").length,
  };

  return <SSLContent certificates={serializedCertificates} stats={stats} />;
}
