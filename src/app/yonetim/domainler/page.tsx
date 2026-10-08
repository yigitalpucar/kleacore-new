import type { Metadata } from "next";
import { getAdminDomainList } from "@/lib/dal/domains";
import { AdminDomainsContent } from "./content";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Alan adları" };

export default async function AdminDomainsPage() {
  await requirePermission("domains.view");
  const domains = await getAdminDomainList();

  return (
    <AdminDomainsContent
      domains={domains.map((d) => ({
        id: d.id,
        name: d.name,
        status: d.status,
        expiresAt: d.expiresAt.toISOString(),
        autoRenew: d.autoRenew,
        registrar: d.registrar,
        lastSyncedAt: d.lastSyncedAt?.toISOString() ?? null,
        customerName: [d.customer.name, d.customer.surname].filter(Boolean).join(" ") || d.customer.email,
        customerId: d.customer.id,
        renewalStatus: d.renewals.find((r) => r.status === "FAILED")?.status ?? d.renewals[0]?.status ?? null,
      }))}
    />
  );
}
