import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getStatuses } from "@/lib/dal/system-status";
import { requireAdmin } from "@/lib/utils/auth-helpers";
import { serializeIncident } from "@/components/admin-b/durum/serialize";
import { OlayDetayContent } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Olay" };

export default async function OlayDetayPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [incident, statuses] = await Promise.all([db.systemIncident.findUnique({ where: { id } }), getStatuses()]);
  if (!incident) notFound();

  return (
    <OlayDetayContent
      incident={serializeIncident(incident)}
      components={statuses.map((s) => s.serviceName)}
      generatedAt={new Date().toISOString()}
    />
  );
}
