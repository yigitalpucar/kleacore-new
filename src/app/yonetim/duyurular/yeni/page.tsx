import type { Metadata } from "next";
import { PageHeader } from "@/components/app";
import { BroadcastComposer } from "@/components/admin/broadcasts/broadcast-composer";
import { hasPermission } from "@/lib/auth/permissions";
import { loadAudienceOptions } from "@/lib/broadcasts/audience";
import { BROADCAST_VARIABLES } from "@/lib/broadcasts/content";
import { getBroadcastRate } from "@/lib/broadcasts/settings";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Yeni duyuru" };

export default async function YeniDuyuruPage() {
  const session = await requirePermission("broadcast.send");
  const [options, components, rate, me] = await Promise.all([
    loadAudienceOptions(),
    db.systemStatus.findMany({ orderBy: { serviceName: "asc" }, select: { id: true, serviceName: true } }),
    getBroadcastRate(),
    db.user.findUnique({ where: { id: session.user.id }, select: { email: true, phone: true } }),
  ]);

  return (
    <>
      <PageHeader
        back={{ href: "/yonetim/duyurular", label: "Duyurular" }}
        title="Yeni duyuru"
        description="Hedef kitleyi seçin, metni yazın, önce kendinize test gönderin; sonra hemen gönderin veya ileri bir tarihe zamanlayın."
      />
      <BroadcastComposer
        options={options}
        variables={BROADCAST_VARIABLES.map((variable) => ({ ...variable }))}
        components={components}
        canPublishStatus={hasPermission(session.user.role, "status.manage")}
        rate={rate}
        me={{ email: me?.email ?? "", phone: me?.phone ?? null }}
      />
    </>
  );
}
