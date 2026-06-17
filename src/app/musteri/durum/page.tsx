import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import {
  getStatuses,
  getActiveIncidents,
  getRecentIncidents,
} from "@/lib/dal/system-status";
import { DurumContent } from "./content";

export const dynamic = "force-dynamic";

export default async function DurumPage() {
  const [statuses, activeIncidents, recentIncidents] = await Promise.all([
    getStatuses(),
    getActiveIncidents(),
    getRecentIncidents(10),
  ]);

  const serializedStatuses = statuses.map((s) => ({
    id: s.id,
    serviceName: s.serviceName,
    status: s.status,
    description: s.description,
    updatedAt: s.updatedAt.toISOString(),
  }));

  const serializeIncident = (i: (typeof activeIncidents)[number]) => ({
    id: i.id,
    title: i.title,
    description: i.description,
    severity: i.severity,
    status: i.status,
    serviceName: i.serviceName,
    startedAt: i.startedAt.toISOString(),
    resolvedAt: i.resolvedAt?.toISOString() ?? null,
    updates: i.updates,
    createdAt: i.createdAt.toISOString(),
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main className="flex-1">
        <DurumContent
          statuses={serializedStatuses}
          activeIncidents={activeIncidents.map(serializeIncident)}
          recentIncidents={recentIncidents.map(serializeIncident)}
        />
      </main>
      <Footer />
    </div>
  );
}
