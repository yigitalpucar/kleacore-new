import type { Metadata } from "next";
import { ServicesContent } from "./content";
import { loadServices } from "./load-services";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Hizmetler" };

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("services.view");
  const sp = await searchParams;
  const { rows, stats, pagination } = await loadServices(sp);

  return (
    <ServicesContent
      rows={rows}
      stats={stats}
      pagination={pagination}
      view={{ title: "Hizmetler", description: "Müşterilere ait tüm hizmetleri izleyin, askıya alın veya yeniden açın." }}
    />
  );
}
