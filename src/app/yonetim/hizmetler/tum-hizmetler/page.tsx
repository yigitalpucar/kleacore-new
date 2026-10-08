import type { Metadata } from "next";
import { ServicesContent } from "../content";
import { loadServices } from "../load-services";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Tüm hizmetler" };

export default async function AllServicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const { rows, stats, pagination } = await loadServices(sp);

  return (
    <ServicesContent
      rows={rows}
      stats={stats}
      pagination={pagination}
      view={{ title: "Tüm hizmetler", description: "Durumdan bağımsız olarak kayıtlı bütün hizmetler." }}
    />
  );
}
