import type { Metadata } from "next";
import { ServicesContent } from "../content";
import { loadServices } from "../load-services";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { listCapabilities } from "@/lib/admin/list-views";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Aktif hizmetler" };

export default async function ActiveServicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("services.view");
  const sp = await searchParams;
  const { rows, stats, pagination } = await loadServices(sp, "ACTIVE");

  return (
    <ServicesContent
      rows={rows}
      stats={stats}
      pagination={pagination}
      capabilities={listCapabilities(session.user.role, "services")}
      view={{ title: "Aktif hizmetler", description: "Şu anda çalışan ve faturalanan hizmetler.", status: "ACTIVE" }}
    />
  );
}
