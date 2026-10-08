import type { Metadata } from "next";
import { getStatuses, getIncidents } from "@/lib/dal/system-status";
import { DurumContent, type StatusIncident, type StatusComponent } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sistem Durumu",
  description:
    "KLEACORE hizmetlerinin güncel durumu, devam eden olaylar, planlı bakımlar ve son 90 günün olay geçmişi.",
  alternates: { canonical: "/musteri/durum" },
  openGraph: {
    title: "Sistem Durumu | KLEACORE",
    description: "KLEACORE hizmetlerinin güncel durumu ve olay geçmişi.",
    url: "/musteri/durum",
  },
};

const HISTORY_DAYS = 90;

export default async function DurumPage() {
  const [statuses, incidents] = await Promise.all([getStatuses(), getIncidents()]);

  const now = Date.now();
  const since = now - HISTORY_DAYS * 24 * 60 * 60 * 1000;

  const components: StatusComponent[] = statuses.map((s) => ({
    id: s.id,
    serviceName: s.serviceName,
    status: s.status,
    description: s.description,
    updatedAt: s.updatedAt.toISOString(),
    createdAt: s.createdAt.toISOString(),
  }));

  // Unresolved incidents always count; resolved ones only inside the window.
  const recent: StatusIncident[] = incidents
    .filter(
      (i) =>
        i.status !== "RESOLVED" ||
        (i.resolvedAt ?? i.startedAt).getTime() >= since
    )
    .map((i) => ({
      id: i.id,
      title: i.title,
      description: i.description,
      severity: i.severity,
      status: i.status,
      serviceName: i.serviceName,
      startedAt: i.startedAt.toISOString(),
      resolvedAt: i.resolvedAt?.toISOString() ?? null,
      updates: i.updates,
      updatedAt: i.updatedAt.toISOString(),
    }))
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));

  return (
    <DurumContent
      components={components}
      incidents={recent}
      historyDays={HISTORY_DAYS}
      generatedAt={new Date(now).toISOString()}
    />
  );
}
