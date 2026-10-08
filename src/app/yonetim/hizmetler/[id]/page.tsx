import type { Metadata } from "next";
import { getServiceById } from "@/lib/dal/services";
import { notFound } from "next/navigation";
import { ServiceDetailContent } from "./content";
import { serializeMoney } from "@/lib/money";
import { getServiceModuleView } from "@/lib/modules/admin-view";
import { getPanelCapabilities } from "@/lib/services/panel-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Hizmet detayı" };

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const service = await getServiceById(id);

  if (!service) return notFound();

  const [moduleView, panel] = await Promise.all([getServiceModuleView(service), getPanelCapabilities(service)]);
  // The encrypted panel password never goes to the browser.
  const { panelPassword, ...rest } = service;

  return (
    <ServiceDetailContent
      service={serializeMoney({ ...rest, hasPanelPassword: Boolean(panelPassword) })}
      moduleView={moduleView}
      panelLogin={panel.sso && (service.status === "ACTIVE" || service.status === "SUSPENDED")}
    />
  );
}
