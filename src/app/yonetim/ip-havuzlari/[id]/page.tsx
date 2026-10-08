import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { IpPoolDetailContent } from "./content";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "IP havuzu" };

export default async function IpPoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("provisioning.manage");
  const { id } = await params;
  const pool = await db.ipPool.findUnique({
    where: { id },
    include: {
      moduleInstance: { select: { id: true, label: true } },
      addresses: {
        orderBy: { sortKey: "asc" },
        include: { service: { select: { id: true, label: true, domain: true } } },
      },
    },
  });
  if (!pool) return notFound();

  return (
    <IpPoolDetailContent
      pool={{
        id: pool.id,
        name: pool.name,
        cidr: pool.cidr,
        gateway: pool.gateway,
        netmask: pool.netmask,
        prefix: pool.prefix,
        dnsServers: pool.dnsServers,
        vlan: pool.vlan,
        releaseCooldownMinutes: pool.releaseCooldownMinutes,
        notes: pool.notes,
        moduleInstance: pool.moduleInstance,
      }}
      addresses={pool.addresses.map((address) => ({
        id: address.id,
        address: address.address,
        status: address.status,
        notes: address.notes,
        assignedAt: address.assignedAt?.toISOString() ?? null,
        cooldownUntil: address.cooldownUntil?.toISOString() ?? null,
        service: address.service,
      }))}
    />
  );
}
