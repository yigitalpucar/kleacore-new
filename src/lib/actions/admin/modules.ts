"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { logActivity } from "@/lib/activity-log";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { requireManifest, runHealthCheck, runSettingsHealthCheck, saveModuleInstance } from "@/lib/modules/instances";
import { syncLegacyModuleInstances, verifyLegacyModuleInstances } from "@/lib/modules/legacy";
import { getModule, parseProductOptions } from "@/lib/modules/registry";
import { describeSchema, formValuesToInput, type SchemaFormValues } from "@/lib/modules/schema-form";
import { requireAdmin } from "@/lib/utils/auth-helpers";

const log = createLogger("actions.admin.modules");
const MODULES_PATH = "/yonetim/moduller";

type ActionResult<T = object> =
  | ({ success: true } & T)
  | { success: false; error: string; fieldErrors?: Record<string, string> };

export interface ModuleInstanceFormInput {
  id?: string;
  moduleId: string;
  label: string;
  values: SchemaFormValues;
  isActive: boolean;
  priority: string;
  groupKey: string;
  capacity: string;
}

function optionalInt(value: string) {
  const text = value.trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isInteger(number) ? number : NaN;
}

export async function saveModuleInstanceAction(input: ModuleInstanceFormInput): Promise<ActionResult<{ id: string }>> {
  const session = await requireAdmin();
  const manifest = getModule(input.moduleId);
  if (!manifest) return { success: false, error: "Modül bulunamadı." };

  const priority = optionalInt(input.priority) ?? 0;
  const capacity = optionalInt(input.capacity);
  if (Number.isNaN(priority)) return { success: false, error: "Öncelik tam sayı olmalı.", fieldErrors: { priority: "Tam sayı girin." } };
  if (Number.isNaN(capacity) || (capacity !== null && capacity < 1)) {
    return { success: false, error: "Kapasite pozitif tam sayı olmalı.", fieldErrors: { capacity: "Pozitif tam sayı girin veya boş bırakın." } };
  }

  const fields = describeSchema(manifest.configSchema, manifest.configFields, manifest.secretFields);
  try {
    const result = await saveModuleInstance({
      id: input.id,
      moduleId: manifest.id,
      label: input.label,
      config: formValuesToInput(fields, input.values),
      isActive: input.isActive,
      priority,
      groupKey: input.groupKey,
      capacity,
    });
    if (!result.ok) return { success: false, error: result.error, fieldErrors: result.fieldErrors };

    await logActivity({
      userId: session.user.id,
      action: input.id ? "MODULE_INSTANCE_UPDATE" : "MODULE_INSTANCE_CREATE",
      entity: "ModuleInstance",
      entityId: result.instance.id,
      // Never the config: it holds credentials.
      details: { moduleId: manifest.id, label: result.instance.label, isActive: result.instance.isActive },
    });

    revalidatePath(MODULES_PATH);
    revalidatePath(`${MODULES_PATH}/${result.instance.id}`);
    return { success: true, id: result.instance.id };
  } catch (error) {
    log.error("save module instance failed", { moduleId: manifest.id, error });
    return { success: false, error: "Modül örneği kaydedilemedi." };
  }
}

/** "Bağlantıyı test et" for an instance; records the result on the row. */
export async function testModuleInstanceAction(id: string): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  const health = await runHealthCheck(id);
  revalidatePath(MODULES_PATH);
  revalidatePath(`${MODULES_PATH}/${id}`);
  return { ok: health.ok, message: health.message ?? (health.ok ? "Bağlantı başarılı." : "Bağlantı başarısız.") };
}

/** Health check of a settings-backed module (payment, e-invoice, SMS). */
export async function testSettingsModuleAction(moduleId: string): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  const health = await runSettingsHealthCheck(moduleId);
  return { ok: health.ok, message: health.message ?? (health.ok ? "Bağlantı başarılı." : "Bağlantı başarısız.") };
}

export async function setModuleInstanceActiveAction(id: string, isActive: boolean): Promise<ActionResult> {
  const session = await requireAdmin();
  const instance = await db.moduleInstance.update({ where: { id }, data: { isActive } }).catch(() => null);
  if (!instance) return { success: false, error: "Modül örneği bulunamadı." };
  await logActivity({
    userId: session.user.id,
    action: isActive ? "MODULE_INSTANCE_ENABLE" : "MODULE_INSTANCE_DISABLE",
    entity: "ModuleInstance",
    entityId: id,
  });
  revalidatePath(MODULES_PATH);
  revalidatePath(`${MODULES_PATH}/${id}`);
  return { success: true };
}

/** Detaches a legacy mirror: its config becomes editable here and stops following the Entegrasyonlar form. */
export async function unlinkLegacyModuleInstanceAction(id: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const instance = await db.moduleInstance.update({ where: { id }, data: { legacySource: null } }).catch(() => null);
  if (!instance) return { success: false, error: "Modül örneği bulunamadı." };
  await logActivity({ userId: session.user.id, action: "MODULE_INSTANCE_UNLINK_LEGACY", entity: "ModuleInstance", entityId: id });
  revalidatePath(`${MODULES_PATH}/${id}`);
  return { success: true };
}

/** Deletes an instance nothing points at (products, services, servers, IP pools). */
export async function deleteModuleInstanceAction(id: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const usage = await db.moduleInstance.findUnique({
    where: { id },
    select: { _count: { select: { products: true, services: true, servers: true, ipPools: true } } },
  });
  if (!usage) return { success: false, error: "Modül örneği bulunamadı." };
  const { products, services, servers, ipPools } = usage._count;
  if (products + services + servers + ipPools > 0) {
    return {
      success: false,
      error: `Bu örneğe bağlı kayıtlar var (${products} ürün, ${services} hizmet, ${servers} sunucu, ${ipPools} IP havuzu). Önce pasif yapın.`,
    };
  }
  await db.moduleInstance.delete({ where: { id } });
  await logActivity({ userId: session.user.id, action: "MODULE_INSTANCE_DELETE", entity: "ModuleInstance", entityId: id });
  revalidatePath(MODULES_PATH);
  return { success: true };
}

/** "Eski ayarları içe aktar": mirrors Settings → instances, then verifies they resolve to the same config. */
export async function syncLegacyModulesAction(): Promise<
  ActionResult<{ reports: Awaited<ReturnType<typeof syncLegacyModuleInstances>>; verification: Awaited<ReturnType<typeof verifyLegacyModuleInstances>> }>
> {
  const session = await requireAdmin();
  try {
    const reports = await syncLegacyModuleInstances();
    const verification = await verifyLegacyModuleInstances();
    await logActivity({
      userId: session.user.id,
      action: "MODULE_LEGACY_SYNC",
      entity: "ModuleInstance",
      details: { reports: reports.map((r) => ({ source: r.source, action: r.action, reason: r.reason ?? null })) },
    });
    revalidatePath(MODULES_PATH);
    return { success: true, reports, verification };
  } catch (error) {
    log.error("legacy module sync failed", { error });
    return { success: false, error: "Eski ayarlar içe aktarılamadı." };
  }
}

// ---------------------------------------------------------------------------
// Product → module binding (Faz 2.2)
// ---------------------------------------------------------------------------

export async function saveProductModuleBindingAction(
  productId: string,
  input: { moduleInstanceId: string | null; values: SchemaFormValues }
): Promise<ActionResult> {
  const session = await requireAdmin();
  const product = await db.product.findUnique({ where: { id: productId }, include: { category: true } });
  if (!product) return { success: false, error: "Ürün bulunamadı." };

  let moduleOptions: Prisma.InputJsonObject = {};
  if (input.moduleInstanceId) {
    const instance = await db.moduleInstance.findUnique({ where: { id: input.moduleInstanceId } });
    if (!instance || instance.kind !== "server") return { success: false, error: "Sunucu modülü örneği bulunamadı." };
    const manifest = requireManifest(instance.moduleId);
    if (manifest.productCategories && !manifest.productCategories.includes(product.category.slug)) {
      return { success: false, error: `${manifest.name} bu ürün kategorisine (${product.category.name}) bağlanamaz.` };
    }
    const fields = manifest.productOptionsSchema
      ? describeSchema(manifest.productOptionsSchema, manifest.productOptionsFields)
      : [];
    const parsed = parseProductOptions(manifest, formValuesToInput(fields, input.values));
    if (!parsed.success) return { success: false, error: "Modül seçenekleri geçersiz.", fieldErrors: parsed.fieldErrors };
    moduleOptions = parsed.data as Prisma.InputJsonObject;
  }

  await db.product.update({
    where: { id: productId },
    data: { moduleInstanceId: input.moduleInstanceId, moduleOptions },
  });
  await logActivity({
    userId: session.user.id,
    action: "PRODUCT_MODULE_BINDING",
    entity: "Product",
    entityId: productId,
    details: { moduleInstanceId: input.moduleInstanceId, moduleOptions },
  });
  revalidatePath(`/yonetim/urunler/paketler/${productId}`);
  revalidatePath(`/yonetim/urunler/paketler/${productId}/duzenle`);
  return { success: true };
}

/**
 * Links an existing (e.g. legacy WHM) service to the instance its account
 * lives on, so suspend/terminate/SSO go through the module. Doesn't touch
 * the remote side.
 */
export async function assignServiceModuleAction(
  serviceId: string,
  input: { moduleInstanceId: string | null; remoteId: string }
): Promise<ActionResult> {
  const session = await requireAdmin();
  const remoteId = input.remoteId.trim() || null;
  if (input.moduleInstanceId) {
    const instance = await db.moduleInstance.findUnique({ where: { id: input.moduleInstanceId }, select: { kind: true } });
    if (!instance || instance.kind !== "server") return { success: false, error: "Sunucu modülü örneği bulunamadı." };
    if (!remoteId) return { success: false, error: "Uzak kimlik (ör. WHM kullanıcı adı) gerekli.", fieldErrors: { remoteId: "Gerekli" } };
  }
  const service = await db.service
    .update({
      where: { id: serviceId },
      data: { moduleInstanceId: input.moduleInstanceId, remoteId: input.moduleInstanceId ? remoteId : null },
    })
    .catch(() => null);
  if (!service) return { success: false, error: "Hizmet bulunamadı." };
  await logActivity({
    userId: session.user.id,
    action: "SERVICE_MODULE_BINDING",
    entity: "Service",
    entityId: serviceId,
    details: { moduleInstanceId: input.moduleInstanceId, remoteId },
  });
  revalidatePath(`/yonetim/hizmetler/${serviceId}`);
  return { success: true };
}
