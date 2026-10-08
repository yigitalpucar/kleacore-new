import type { Prisma, Product, Service } from "@prisma/client";
import { getCpanelWhmConfig } from "@/lib/integrations/provisioning/config";
import { isCpanelCategory, isVpsVdsCategory } from "@/lib/integrations/provisioning/categories";
import { getSettingValue } from "@/lib/integrations/settings";
import { sendNotification } from "@/lib/notifications/send";

export const DEFAULT_NAMESERVERS = ["ns1.kleacore.com", "ns2.kleacore.com"];

export function activationKindForCategory(slug: string): "hosting" | "server" | "other" {
  const normalized = slug.toLowerCase();
  if (isCpanelCategory(normalized)) return "hosting";
  if (isVpsVdsCategory(normalized) || normalized === "datacenter") return "server";
  return "other";
}

/** Customer-facing cPanel URL: `cpanel_customer_url`, else https://<WHM host>:2083. */
async function hostingPanelUrl() {
  const configured = (await getSettingValue("cpanel_customer_url", "CPANEL_CUSTOMER_URL")).trim();
  if (configured) return configured;
  const config = await getCpanelWhmConfig();
  return config.host ? `https://${config.host.replace(/^https?:\/\//, "").replace(/[:/].*$/, "")}:2083` : undefined;
}

function serviceLabel(service: Pick<Service, "label" | "domain">, product: Pick<Product, "name">) {
  const name = service.label?.trim() || product.name;
  return service.domain && !name.includes(service.domain) ? `${name} — ${service.domain}` : name;
}

/**
 * Queues "hizmet aktif + giriş bilgileri" (once per service). Hosting:
 * cPanel user + panel URL + nameservers. Server: IP, hostname, user and the
 * initial password when the admin chose to include it (encrypted in the
 * queue/log, redacted in the customer inbox copy).
 */
export async function queueServiceActivatedNotice(
  tx: Prisma.TransactionClient | undefined,
  input: {
    service: Service & { product: Product };
    kind: "hosting" | "server" | "other";
    panelUrl?: string;
    password?: string;
    passwordDelivery?: "included" | "separately" | "panel";
    notes?: string;
  }
) {
  const { service, kind } = input;
  const panelUrl = input.panelUrl ?? (kind === "hosting" ? await hostingPanelUrl() : undefined);

  return sendNotification({
    userId: service.customerId,
    template: "service.activated",
    data: {
      serviceId: service.id,
      serviceLabel: serviceLabel(service, service.product),
      kind,
      domain: service.domain ?? undefined,
      username: service.username ?? undefined,
      panelUrl,
      nameservers: kind === "hosting" ? DEFAULT_NAMESERVERS : undefined,
      ipAddress: kind === "server" ? (service.ipAddress ?? undefined) : undefined,
      hostname: kind === "server" ? (service.serverName ?? undefined) : undefined,
      password: input.password,
      passwordDelivery: input.passwordDelivery ?? (kind === "hosting" ? "panel" : undefined),
      notes: input.notes,
    },
    dedupeKey: `service.activated:${service.id}`,
    tx,
  });
}
