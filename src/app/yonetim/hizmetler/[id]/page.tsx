import type { Metadata } from "next";
import { getServiceById } from "@/lib/dal/services";
import { notFound } from "next/navigation";
import { ServiceDetailContent } from "./content";
import { serializeMoney } from "@/lib/money";
import { getServiceModuleView } from "@/lib/modules/admin-view";
import { getProxmoxAdminView } from "@/lib/modules/server-panel";
import { omitModuleData } from "@/lib/modules/service-state";
import { getPanelCapabilities } from "@/lib/services/panel-access";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { hasPermission } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Hizmet detayı" };

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePermission("services.view");
  const canManage = hasPermission(session.user.role, "services.manage");
  const { id } = await params;
  const service = await getServiceById(id);

  if (!service) return notFound();

  const [moduleView, proxmoxView, panel] = await Promise.all([
    getServiceModuleView(service),
    getProxmoxAdminView(service),
    getPanelCapabilities(service),
  ]);
  // Never ship secrets to the browser: moduleData may hold encrypted VDS
  // credentials, panelPassword the encrypted cPanel password.
  const { panelPassword, ...rest } = omitModuleData(service);

  return (
    <ServiceDetailContent
      service={serializeMoney({ ...rest, hasPanelPassword: Boolean(panelPassword) })}
      moduleView={moduleView}
      proxmoxView={proxmoxView}
      canManage={canManage}
      canCreateInvoice={hasPermission(session.user.role, "invoices.edit")}
      panelLogin={canManage && !proxmoxView && panel.sso && (service.status === "ACTIVE" || service.status === "SUSPENDED")}
    />
  );
}
