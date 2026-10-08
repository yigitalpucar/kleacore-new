"use server";

import { db } from "@/lib/db";
import { requireCustomer } from "@/lib/utils/auth-helpers";
import { runRemoteServerAction } from "@/lib/integrations/provisioning-provider";
import { revalidatePath } from "next/cache";
import { CUSTOMER_STOPPED_REASON, customerStartBlockReason } from "@/lib/services/server-power";
import { createLogger } from "@/lib/logger";
import { logActivity } from "@/lib/activity-log";

const log = createLogger("actions.customer.servers");

const REMOTE_FAILED = "Sunucu işlemi tamamlanamadı. Lütfen biraz sonra tekrar deneyin veya destek talebi açın.";

/**
 * Bound (module) services: the remote result decides; a failed power action
 * must not flip the local status. Legacy services keep the old behaviour.
 */
function remoteFailed(service: { id: string; moduleInstanceId: string | null }, integration: { ok: boolean; skipped?: boolean; error?: string }) {
  if (!service.moduleInstanceId || integration.ok || integration.skipped) return false;
  log.warn("server power action failed", { serviceId: service.id, error: integration.error });
  return true;
}

function revalidateServer(serviceId: string) {
  revalidatePath("/musteri/panel/sunucular");
  revalidatePath(`/musteri/panel/hizmetlerim/${serviceId}`);
}

async function findOwnedService(serviceId: string, userId: string) {
  return db.service.findFirst({
    where: {
      id: serviceId,
      customerId: userId,
      product: { category: { slug: { in: ["vds", "vps", "cloud", "server"] } } },
    },
    include: {
      product: {
        include: {
          category: true,
        },
      },
    },
  });
}

export async function restartServer(serviceId: string) {
  const session = await requireCustomer();
  const userId = session.user.id;

  const service = await findOwnedService(serviceId, userId);
  if (!service) {
    return { success: false, error: "Sunucu bulunamadi" };
  }

  if (service.status !== "ACTIVE") {
    return { success: false, error: "Sadece aktif sunucular yeniden baslatilabilir" };
  }

  const integration = await runRemoteServerAction(service, "restart");
  if (remoteFailed(service, integration)) return { success: false, error: REMOTE_FAILED };

  await db.service.update({
    where: { id: serviceId },
    data: { status: "ACTIVE" },
  });

  revalidateServer(serviceId);
  return { success: true, integration };
}

export async function stopServer(serviceId: string) {
  const session = await requireCustomer();
  const userId = session.user.id;

  const service = await findOwnedService(serviceId, userId);
  if (!service) {
    return { success: false, error: "Sunucu bulunamadi" };
  }

  if (service.status !== "ACTIVE") {
    return { success: false, error: "Sunucu zaten aktif degil" };
  }

  const integration = await runRemoteServerAction(service, "stop");
  if (remoteFailed(service, integration)) return { success: false, error: REMOTE_FAILED };

  await db.service.update({
    where: { id: serviceId },
    data: { status: "SUSPENDED", suspendedAt: new Date(), suspendReason: CUSTOMER_STOPPED_REASON },
  });

  revalidateServer(serviceId);
  return { success: true, integration };
}

export async function startServer(serviceId: string) {
  const session = await requireCustomer();
  const userId = session.user.id;

  const service = await findOwnedService(serviceId, userId);
  if (!service) {
    return { success: false, error: "Sunucu bulunamadi" };
  }

  // Only a server the customer stopped may be started here; billing/admin
  // suspensions and expired services must not be reopened from the panel.
  const blockReason = customerStartBlockReason(service);
  if (blockReason) {
    return { success: false, error: blockReason };
  }

  const integration = await runRemoteServerAction(service, "start");
  if (remoteFailed(service, integration)) return { success: false, error: REMOTE_FAILED };

  await db.service.update({
    where: { id: serviceId },
    data: { status: "ACTIVE", suspendedAt: null, suspendReason: null },
  });

  revalidateServer(serviceId);
  return { success: true, integration };
}

/** A running or customer-stopped server with a remote VM (not billing-suspended, not pending). */
function canManageServer(service: { status: string; suspendReason: string | null; remoteId: string | null }) {
  if (!service.remoteId) return "Sunucu henüz hazır değil";
  if (service.status === "ACTIVE" || customerStartBlockReason(service) === null) return null;
  return customerStartBlockReason(service) ?? "Bu işlem şu anda yapılamaz";
}

/**
 * Shows the initial cloud-init credentials once. After this the password is
 * no longer retrievable from the panel (the customer should change it).
 */
export async function revealServerCredentials(serviceId: string) {
  const session = await requireCustomer();
  const service = await findOwnedService(serviceId, session.user.id);
  if (!service || !service.moduleInstanceId) return { success: false as const, error: "Sunucu bulunamadı" };
  const blocked = canManageServer(service);
  if (blocked) return { success: false as const, error: blocked };

  const { revealInitialCredentials, CredentialsError } = await import("@/lib/modules/server-panel");
  try {
    const credentials = await revealInitialCredentials(serviceId);
    await logActivity({
      userId: session.user.id,
      action: "SERVER_CREDENTIALS_REVEALED",
      entity: "Service",
      entityId: serviceId,
      details: { revealedAt: credentials.revealedAt },
    });
    revalidateServer(serviceId);
    return { success: true as const, credentials };
  } catch (error) {
    if (error instanceof CredentialsError) return { success: false as const, error: error.message };
    log.error("credential reveal failed", { serviceId, error: error instanceof Error ? error.message : String(error) });
    return { success: false as const, error: "Giriş bilgileri alınamadı" };
  }
}

/**
 * Reinstalls the OS from the product template (same IP and server number).
 * Everything on the disk is erased: the customer must type the hostname.
 */
export async function reinstallServer(serviceId: string, input: { confirmation: string; sshKeys?: string }) {
  const session = await requireCustomer();
  const service = await findOwnedService(serviceId, session.user.id);
  if (!service || !service.moduleInstanceId) return { success: false as const, error: "Sunucu bulunamadı" };
  const blocked = canManageServer(service);
  if (blocked) return { success: false as const, error: blocked };

  const { getVdsPanelView, parseSshKeysInput, queueServerReinstall } = await import("@/lib/modules/server-panel");
  const view = await getVdsPanelView(service);
  if (!view?.capabilities.reinstall) return { success: false as const, error: "Bu sunucu için yeniden kurulum desteklenmiyor" };
  if (view.reinstall && ["queued", "destroy", "provision"].includes(view.reinstall.phase)) {
    return { success: false as const, error: "Yeniden kurulum zaten sürüyor" };
  }
  if (input.confirmation.trim() !== view.hostname) {
    return { success: false as const, error: `Onay için sunucu adını (${view.hostname}) yazın` };
  }

  let sshKeys: string[] | undefined;
  if (input.sshKeys?.trim()) {
    const parsed = parseSshKeysInput(input.sshKeys);
    if ("error" in parsed) return { success: false as const, error: parsed.error };
    sshKeys = parsed.keys;
  }

  try {
    await queueServerReinstall(serviceId, { sshKeys });
  } catch (error) {
    log.error("reinstall enqueue failed", { serviceId, error: error instanceof Error ? error.message : String(error) });
    return { success: false as const, error: "Yeniden kurulum başlatılamadı, lütfen tekrar deneyin" };
  }
  await logActivity({
    userId: session.user.id,
    action: "SERVER_REINSTALL_REQUESTED",
    entity: "Service",
    entityId: serviceId,
    details: { sshKeys: sshKeys?.length ?? 0 },
  });
  revalidateServer(serviceId);
  return { success: true as const };
}

/** "Yenile" on the usage card: pulls fresh usage now (max once per minute). */
export async function refreshServerUsage(serviceId: string) {
  const session = await requireCustomer();
  const service = await findOwnedService(serviceId, session.user.id);
  if (!service || !service.moduleInstanceId) return { success: false as const, error: "Sunucu bulunamadı" };
  const { refreshServiceUsage } = await import("@/lib/modules/server-panel");
  const result = await refreshServiceUsage(service, { maxAgeMs: 60_000 });
  revalidateServer(serviceId);
  if (result.error) return { success: false as const, error: "Kullanım verisi alınamadı" };
  return { success: true as const, refreshed: result.refreshed };
}
