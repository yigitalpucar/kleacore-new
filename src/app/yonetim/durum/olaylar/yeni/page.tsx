import type { Metadata } from "next";
import { PageHeader } from "@/components/app";
import { IncidentForm } from "@/components/admin-b/durum/incident-form";
import { getStatuses } from "@/lib/dal/system-status";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Olay bildir" };

export default async function YeniOlayPage({ searchParams }: { searchParams: Promise<{ bilesen?: string }> }) {
  await requirePermission("status.manage");
  const [{ bilesen }, statuses] = await Promise.all([searchParams, getStatuses()]);
  const names = statuses.map((s) => s.serviceName);

  return (
    <>
      <PageHeader
        back={{ href: "/yonetim/durum", label: "Sistem durumu" }}
        title="Olay bildir"
        description="Kesinti, yavaşlık veya hata gibi müşterileri etkileyen bir sorunu durum sayfasında duyurun."
      />
      <IncidentForm components={names} defaultComponent={bilesen && names.includes(bilesen) ? bilesen : undefined} />
    </>
  );
}
