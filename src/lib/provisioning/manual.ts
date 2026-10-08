import type { BillingPeriod, Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSettingValue } from "@/lib/integrations/settings";
import {
  getCpanelWhmConfig,
  getVpsVdsConfig,
  isCpanelWhmConfigured,
  isVpsVdsConfigured,
} from "@/lib/integrations/provisioning/config";
import { isCpanelCategory, isVpsVdsCategory } from "@/lib/integrations/provisioning/categories";
import { createLogger } from "@/lib/logger";
import { sendNotification } from "@/lib/notifications/send";
import { encryptSecret } from "@/lib/secrets/crypto";
import { activationKindForCategory, queueServiceActivatedNotice } from "./activation-notice";

const log = createLogger("provisioning.manual");

type DbClient = Prisma.TransactionClient | typeof db;

/** Categories always provisioned by hand (owner decision: VDS manual in Faz 1). Comma separated slugs. */
export const MANUAL_CATEGORIES_SETTING = "manual_provisioning_categories";
const DEFAULT_MANUAL_CATEGORIES = "vds";

export const MANUAL_SLA_HOURS_SETTING = "manual_provisioning_sla_hours";
const DEFAULT_SLA_HOURS = 24;

export const MANUAL_ETA_TEXT_SETTING = "manual_provisioning_eta_text";
export const DEFAULT_ETA_TEXT =
  "Kurulum genellikle 24 saat içinde tamamlanır. Hizmetiniz hazır olduğunda giriş bilgileriniz e-posta ile gönderilir.";

/** Categories handled by their own flows (registrar / SSL issuer), never manual tasks. */
const NON_SERVICE_CATEGORIES = new Set(["domain", "ssl"]);

export function parseCategoryList(value: string | null | undefined) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((slug) => slug.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * True when a paid order of this category has no automation module and must
 * become an admin task: categories listed in `manual_provisioning_categories`
 * (default "vds"), cPanel categories without a configured WHM, VPS/VDS
 * categories without a configured Virtualizor/HTTP provider, and every other
 * service category (e.g. datacenter).
 */
export async function requiresManualProvisioning(categorySlug: string) {
  const slug = categorySlug.toLowerCase();
  if (NON_SERVICE_CATEGORIES.has(slug)) return false;

  const forced = parseCategoryList(
    await getSettingValue(MANUAL_CATEGORIES_SETTING, undefined, DEFAULT_MANUAL_CATEGORIES)
  );
  if (forced.has(slug)) return true;

  if (isCpanelCategory(slug)) return !isCpanelWhmConfigured(await getCpanelWhmConfig());
  if (isVpsVdsCategory(slug)) return !isVpsVdsConfigured(await getVpsVdsConfig());
  return true;
}

export async function getManualSlaHours() {
  const value = Number((await getSettingValue(MANUAL_SLA_HOURS_SETTING, undefined, String(DEFAULT_SLA_HOURS))).trim());
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_SLA_HOURS;
}

export async function getManualEtaText() {
  return (await getSettingValue(MANUAL_ETA_TEXT_SETTING, undefined, DEFAULT_ETA_TEXT)).trim() || DEFAULT_ETA_TEXT;
}

export { slaState, type SlaState } from "./sla";

async function adminRecipients() {
  const email =
    (await getSettingValue("admin_notification_email")).trim() ||
    (await getSettingValue("support_email")).trim() ||
    (await getSettingValue("company_email")).trim() ||
    undefined;
  const phone = (await getSettingValue("admin_notification_phone")).trim() || undefined;
  return { email, phone };
}

/**
 * Opens the admin task for a paid order that needs manual provisioning
 * (service already created as PENDING) and notifies the staff: e-mail (SMS
 * when configured and `admin_notification_phone` is set) plus an in-app
 * notification for every admin. Runs inside the payment transaction so the
 * task exists exactly when the payment committed. Idempotent per order.
 */
export async function openManualProvisioningTask(
  tx: Prisma.TransactionClient,
  input: {
    orderId: string;
    orderNumber: string;
    serviceId: string;
    productName: string;
    customerName: string;
    customerEmail: string;
    domain?: string | null;
  }
) {
  const now = new Date();
  const task = await tx.provisioningJob.upsert({
    where: { orderId: input.orderId },
    update: {},
    create: {
      orderId: input.orderId,
      serviceId: input.serviceId,
      kind: "MANUAL",
      status: "PENDING",
      attempts: 0,
      maxAttempts: 1,
      nextRetryAt: now,
    },
  });

  const slaHours = await getManualSlaHours();
  const recipients = await adminRecipients();

  if (recipients.email || recipients.phone) {
    await sendNotification({
      template: "admin.manual-provisioning",
      data: {
        taskId: task.id,
        orderNumber: input.orderNumber,
        productName: input.productName,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        domain: input.domain ?? undefined,
        paidAt: now,
        slaHours,
      },
      to: recipients.email,
      phone: recipients.phone,
      dedupeKey: `manual-provisioning:${task.id}`,
      tx,
    });
  } else {
    log.warn("no admin e-mail configured for manual provisioning notices", { taskId: task.id });
  }

  const admins = await tx.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { id: true } });
  if (admins.length > 0) {
    await tx.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        type: "WARNING" as const,
        title: "Manuel kurulum bekliyor",
        message: `${input.productName} — ${input.orderNumber} (${input.customerName})`,
        link: `/yonetim/kurulumlar/${task.id}`,
      })),
    });
  }

  return task;
}

const billingMonths: Record<BillingPeriod, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  yearly: 12,
  biennial: 24,
  triennial: 36,
};

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || undefined);

export const manualActivationSchema = z
  .object({
    ipAddress: optionalText(64).refine(
      (value) => !value || /^[0-9a-fA-F:.]+$/.test(value),
      "Geçerli bir IP adresi girin"
    ),
    hostname: optionalText(253),
    username: optionalText(64),
    password: z.string().max(200).optional().transform((value) => value || undefined),
    passwordDelivery: z.enum(["included", "separately"]),
    panelUrl: optionalText(500).refine((value) => !value || /^https?:\/\//i.test(value), "Panel adresi http(s):// ile başlamalı"),
    notes: optionalText(2000),
  })
  .refine((value) => value.passwordDelivery === "separately" || Boolean(value.password), {
    path: ["password"],
    message: "İlk şifreyi girin veya “Şifre müşteriye ayrıca iletildi” seçin",
  });

export type ManualActivationInput = z.input<typeof manualActivationSchema>;

export class ManualProvisioningError extends Error {
  constructor(readonly code: "TASK_NOT_FOUND" | "TASK_NOT_PENDING" | "SERVICE_NOT_FOUND" | "SERVICE_NOT_PENDING") {
    super(code);
    this.name = "ManualProvisioningError";
  }
}

/**
 * "Aktifleştir": stores the delivery details (initial password encrypted),
 * flips the service PENDING → ACTIVE starting its billing period now, closes
 * the task and queues the customer's "hizmet aktif" mail — all in one
 * transaction. The task is claimed with a conditional update, so a double
 * click activates (and mails) once.
 */
export async function activateManualProvisioning(taskId: string, raw: ManualActivationInput, adminId: string) {
  const input = manualActivationSchema.parse(raw);

  return db.$transaction(async (tx) => {
    const task = await tx.provisioningJob.findUnique({
      where: { id: taskId },
      include: {
        order: { select: { id: true, orderNumber: true, serviceId: true } },
      },
    });
    if (!task || task.kind !== "MANUAL") throw new ManualProvisioningError("TASK_NOT_FOUND");

    const serviceId = task.serviceId ?? task.order.serviceId;
    if (!serviceId) throw new ManualProvisioningError("SERVICE_NOT_FOUND");

    const now = new Date();
    const claimed = await tx.provisioningJob.updateMany({
      where: { id: task.id, status: { in: ["PENDING", "PROCESSING", "FAILED"] } },
      data: {
        status: "COMPLETED",
        completedAt: now,
        completedBy: adminId,
        lastError: null,
        attempts: { increment: 1 },
        deliveryDetails: {
          ipAddress: input.ipAddress ?? null,
          hostname: input.hostname ?? null,
          username: input.username ?? null,
          panelUrl: input.panelUrl ?? null,
          passwordDelivery: input.passwordDelivery,
          passwordEncrypted: input.password && input.passwordDelivery === "included" ? encryptSecret(input.password) : null,
          notes: input.notes ?? null,
          activatedAt: now.toISOString(),
          activatedBy: adminId,
        },
      },
    });
    if (claimed.count === 0) throw new ManualProvisioningError("TASK_NOT_PENDING");

    const service = await tx.service.findUnique({
      where: { id: serviceId },
      include: { product: { include: { category: true } } },
    });
    if (!service) throw new ManualProvisioningError("SERVICE_NOT_FOUND");
    if (service.status !== "PENDING") throw new ManualProvisioningError("SERVICE_NOT_PENDING");

    const expiresAt = service.expiresAt ?? addMonths(now, billingMonths[service.billingPeriod] ?? 1);
    const updated = await tx.service.update({
      where: { id: service.id },
      data: {
        status: "ACTIVE",
        ipAddress: input.ipAddress ?? service.ipAddress,
        serverName: input.hostname ?? service.serverName,
        username: input.username ?? service.username,
        nextDueDate: service.nextDueDate ?? expiresAt,
        expiresAt,
      },
    });

    await tx.orderActivity.create({
      data: {
        orderId: task.order.id,
        action: "MANUAL_PROVISIONING_COMPLETED",
        description: "Manuel kurulum tamamlandı, hizmet aktifleştirildi",
        performedBy: adminId,
        metadata: { taskId: task.id, serviceId: service.id, passwordDelivery: input.passwordDelivery },
      },
    });

    await queueServiceActivatedNotice(tx, {
      service: { ...updated, product: service.product },
      kind: activationKindForCategory(service.product.category.slug),
      panelUrl: input.panelUrl,
      password: input.passwordDelivery === "included" ? input.password : undefined,
      passwordDelivery: input.passwordDelivery,
      notes: input.notes,
    });

    return { serviceId: service.id, orderId: task.order.id, orderNumber: task.order.orderNumber };
  });
}
