import type { Metadata } from "next";
import { describeAudience, parseAudience } from "@/lib/broadcasts/audience";
import { getRecipientCountsFor } from "@/lib/broadcasts/progress";
import { getBroadcastRate } from "@/lib/broadcasts/settings";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { DuyurularContent } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Duyurular" };

export default async function DuyurularPage() {
  await requirePermission("broadcast.send");

  const [broadcasts, rate, products, categories, instances] = await Promise.all([
    db.broadcast.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        kind: true,
        subject: true,
        channels: true,
        audience: true,
        status: true,
        scheduledAt: true,
        startedAt: true,
        completedAt: true,
        totalRecipients: true,
        createdAt: true,
      },
    }),
    getBroadcastRate(),
    db.product.findMany({ select: { id: true, name: true } }),
    db.productCategory.findMany({ select: { id: true, name: true } }),
    db.moduleInstance.findMany({ where: { kind: "server" }, select: { id: true, label: true } }),
  ]);
  const counts = await getRecipientCountsFor(broadcasts.map((broadcast) => broadcast.id));
  const labels = {
    products: new Map(products.map((row) => [row.id, row.name])),
    categories: new Map(categories.map((row) => [row.id, row.name])),
    instances: new Map(instances.map((row) => [row.id, row.label])),
  };

  return (
    <DuyurularContent
      rate={rate}
      rows={broadcasts.map((broadcast) => {
        const c = counts.get(broadcast.id);
        let audience = "—";
        try {
          audience = describeAudience(parseAudience(broadcast.audience), labels);
        } catch {
          // stored filter from an older shape
        }
        return {
          id: broadcast.id,
          kind: broadcast.kind,
          subject: broadcast.subject,
          channels: broadcast.channels,
          audience,
          status: broadcast.status,
          scheduledAt: broadcast.scheduledAt?.toISOString() ?? null,
          createdAt: broadcast.createdAt.toISOString(),
          total: c?.total ?? broadcast.totalRecipients,
          sent: c?.SENT ?? 0,
          failed: c?.FAILED ?? 0,
        };
      })}
    />
  );
}
