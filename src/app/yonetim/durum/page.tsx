import type { Metadata } from "next";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import { getIncidents, getStatuses } from "@/lib/dal/system-status";
import { serializeComponents, serializeIncident } from "@/components/admin-b/durum/serialize";
import { DurumYonetimContent } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sistem durumu" };

export default async function DurumYonetimPage() {
  await requireAdmin();
  const [statuses, incidents] = await Promise.all([getStatuses(), getIncidents()]);

  return (
    <DurumYonetimContent
      components={serializeComponents(statuses, incidents)}
      incidents={incidents.map(serializeIncident)}
      generatedAt={new Date().toISOString()}
    />
  );
}
