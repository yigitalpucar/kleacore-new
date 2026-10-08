import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdminDomainDetail } from "@/lib/dal/domains";
import { toNumber } from "@/lib/money";
import { AdminDomainDetailContent } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Alan adı detayı" };

export default async function AdminDomainDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const domain = await getAdminDomainDetail(id);
  if (!domain) notFound();

  return (
    <AdminDomainDetailContent
      domain={{
        id: domain.id,
        name: domain.name,
        status: domain.status,
        registrar: domain.registrar,
        registeredAt: domain.registeredAt.toISOString(),
        expiresAt: domain.expiresAt.toISOString(),
        autoRenew: domain.autoRenew,
        lastSyncedAt: domain.lastSyncedAt?.toISOString() ?? null,
        nameservers: Array.isArray(domain.nameservers) ? (domain.nameservers as string[]) : [],
        dnsRecordCount: domain._count.dnsRecords,
        customer: {
          id: domain.customer.id,
          name: [domain.customer.name, domain.customer.surname].filter(Boolean).join(" ") || domain.customer.email,
          email: domain.customer.email,
        },
      }}
      renewals={domain.renewals.map((r) => ({
        id: r.id,
        status: r.status,
        source: r.source,
        years: r.years,
        periodStart: r.periodStart.toISOString(),
        newExpiresAt: r.newExpiresAt?.toISOString() ?? null,
        attempts: r.attempts,
        lastError: r.lastError,
        createdAt: r.createdAt.toISOString(),
        invoice: r.invoice
          ? { id: r.invoice.id, number: r.invoice.invoiceNumber, status: r.invoice.status, total: toNumber(r.invoice.totalAmount) }
          : null,
      }))}
      notices={domain.notices.map((n) => ({ id: n.id, kind: n.kind, sentAt: n.sentAt.toISOString() }))}
      events={domain.lifecycleEvents.map((e) => ({
        id: e.id,
        type: e.type,
        message: e.message,
        createdAt: e.createdAt.toISOString(),
        actorId: e.actorId,
      }))}
    />
  );
}
