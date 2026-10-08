import type { Metadata } from "next";
import { getServiceById } from "@/lib/dal/services";
import { notFound } from "next/navigation";
import { ServiceDetailContent } from "./content";
import { serializeMoney } from "@/lib/money";
import { getServiceModuleView } from "@/lib/modules/admin-view";
import { getProxmoxAdminView } from "@/lib/modules/server-panel";
import { omitModuleData } from "@/lib/modules/service-state";

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

  const [moduleView, proxmoxView] = await Promise.all([getServiceModuleView(service), getProxmoxAdminView(service)]);

  // moduleData may hold encrypted credentials: never ship it to the browser.
  return (
    <ServiceDetailContent service={serializeMoney(omitModuleData(service))} moduleView={moduleView} proxmoxView={proxmoxView} />
  );
}
