import type { Metadata } from "next";
import { ServicesContent } from "../content";
import { loadServices } from "../load-services";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { listCapabilities } from "@/lib/admin/list-views";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "İptal edilen hizmetler" };

export default async function CancelledServicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("services.view");
  const sp = await searchParams;
  const { rows, stats, pagination } = await loadServices(sp, "CANCELLED");

  return (
    <ServicesContent
      rows={rows}
      stats={stats}
      pagination={pagination}
      capabilities={listCapabilities(session.user.role, "services")}
      view={{ title: "İptal edilen hizmetler", description: "İptal edilmiş hizmetlerin kaydı.", status: "CANCELLED" }}
    />
  );
}
