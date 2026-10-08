import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getIpPoolUsage } from "@/lib/ipam";
import { IpHavuzlariContent, type PoolRow } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "IP havuzları" };

export default async function IpHavuzlariPage() {
  const pools = await db.ipPool.findMany({
    orderBy: { createdAt: "asc" },
    include: { moduleInstance: { select: { id: true, label: true } } },
  });
  const usage = await getIpPoolUsage(pools.map((pool) => pool.id));

  const rows: PoolRow[] = pools.map((pool) => ({
    id: pool.id,
    name: pool.name,
    cidr: pool.cidr,
    gateway: pool.gateway,
    vlan: pool.vlan,
    moduleInstance: pool.moduleInstance,
    ...(usage.get(pool.id) ?? { total: 0, free: 0, assigned: 0, reserved: 0 }),
  }));

  return <IpHavuzlariContent pools={rows} />;
}
