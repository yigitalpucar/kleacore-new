import { auth } from "@/lib/auth";
import { getServerServicesByCustomer } from "@/lib/dal/servers";
import { SunucularContent } from "./content";

export default async function SunucularPage() {
  const session = await auth();
  const services = await getServerServicesByCustomer(session!.user.id);

  const serializedServers = services.map((s) => ({
    id: s.id,
    label: s.label,
    productName: s.product.name,
    categorySlug: s.product.category?.slug ?? "vds",
    domain: s.domain ?? null,
    ipAddress: s.ipAddress ?? null,
    status: s.status,
    cpuUsage: Number(s.cpuUsage ?? 0),
    ramUsage: Number(s.ramUsage ?? 0),
    diskUsed: Number(s.diskUsed ?? 0),
    diskLimit: Number(s.diskLimit ?? 0),
    createdAt: s.createdAt.toISOString(),
    expiresAt: s.expiresAt ? s.expiresAt.toISOString() : null,
  }));

  const stats = {
    total: services.length,
    active: services.filter((s) => s.status === "ACTIVE").length,
    suspended: services.filter((s) => s.status === "SUSPENDED").length,
  };

  return <SunucularContent servers={serializedServers} stats={stats} />;
}
