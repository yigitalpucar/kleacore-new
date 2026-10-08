import type { NotificationChannel, Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { createLogger } from "@/lib/logger";
import { isZero } from "@/lib/money";
import { sendNotification } from "./send";

const log = createLogger("notifications.reminders");

/**
 * Invoice reminder schedule (roadmap 3.3), configurable on
 * /yonetim/bildirimler/hatirlatmalar (setting `invoice_reminder_schedule`).
 *
 * Each step fires on the calendar day (Europe/Istanbul) `offsetDays` from the
 * due date: negative → "ödeme hatırlatması" (billing.invoice-reminder),
 * zero or positive → "fatura gecikti" (billing.invoice-overdue). The "son
 * uyarı" (billing.invoice-final-warning) goes out on the day before services
 * are suspended (due + suspend_grace_days − 1), only for invoices whose unpaid
 * state would suspend an active service.
 *
 * Every (invoice, step, channel) is sent at most once: the NotificationLog
 * dedupe key `invoice.reminder:<invoiceId>:<step>` is unique per channel.
 */

export const REMINDER_SCHEDULE_SETTING = "invoice_reminder_schedule";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Europe/Istanbul is UTC+3 all year (no DST since 2016). */
const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;
/** Two schedule notices never go out within this window for one invoice. */
const QUIET_MS = 20 * 60 * 60 * 1000;

const stepSchema = z.object({
  offsetDays: z.number().int().min(-30).max(60),
  email: z.boolean(),
  sms: z.boolean(),
});

export const reminderScheduleSchema = z
  .object({
    steps: z.array(stepSchema).max(10),
    finalWarning: z.object({ enabled: z.boolean(), email: z.boolean(), sms: z.boolean() }),
  })
  .superRefine((schedule, ctx) => {
    const seen = new Set<number>();
    schedule.steps.forEach((step, index) => {
      if (seen.has(step.offsetDays)) {
        ctx.addIssue({ code: "custom", path: ["steps", index, "offsetDays"], message: "Aynı gün iki kez kullanılamaz." });
      }
      seen.add(step.offsetDays);
      if (!step.email && !step.sms) {
        ctx.addIssue({ code: "custom", path: ["steps", index], message: "En az bir kanal (e-posta veya SMS) seçin." });
      }
    });
    if (schedule.finalWarning.enabled && !schedule.finalWarning.email && !schedule.finalWarning.sms) {
      ctx.addIssue({ code: "custom", path: ["finalWarning"], message: "Son uyarı için en az bir kanal seçin." });
    }
  });

export type ReminderSchedule = z.infer<typeof reminderScheduleSchema>;
export type ReminderStep = z.infer<typeof stepSchema>;

export const DEFAULT_REMINDER_SCHEDULE: ReminderSchedule = {
  steps: [
    { offsetDays: -3, email: true, sms: true },
    { offsetDays: -1, email: true, sms: false },
    { offsetDays: 1, email: true, sms: false },
    { offsetDays: 3, email: true, sms: true },
    { offsetDays: 7, email: true, sms: false },
  ],
  finalWarning: { enabled: true, email: true, sms: true },
};

export function parseReminderSchedule(value: string | null | undefined): ReminderSchedule {
  if (!value?.trim()) return DEFAULT_REMINDER_SCHEDULE;
  try {
    const parsed = reminderScheduleSchema.safeParse(JSON.parse(value));
    if (parsed.success) return normalizeSchedule(parsed.data);
  } catch {
    // fall through
  }
  log.warn("invalid invoice_reminder_schedule setting; using the default schedule");
  return DEFAULT_REMINDER_SCHEDULE;
}

function normalizeSchedule(schedule: ReminderSchedule): ReminderSchedule {
  return { ...schedule, steps: [...schedule.steps].sort((a, b) => a.offsetDays - b.offsetDays) };
}

export async function getReminderSchedule(): Promise<ReminderSchedule> {
  const row = await db.setting.findUnique({ where: { key: REMINDER_SCHEDULE_SETTING }, select: { value: true } });
  return parseReminderSchedule(row?.value);
}

export async function saveReminderSchedule(input: unknown) {
  const parsed = reminderScheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, issues: parsed.error.issues };
  const schedule = normalizeSchedule(parsed.data);
  await db.setting.upsert({
    where: { key: REMINDER_SCHEDULE_SETTING },
    create: {
      key: REMINDER_SCHEDULE_SETTING,
      group: "notifications",
      type: "json",
      label: "Fatura hatırlatma takvimi",
      value: JSON.stringify(schedule),
    },
    update: { value: JSON.stringify(schedule) },
  });
  return { ok: true as const, schedule };
}

/** Calendar day index in Europe/Istanbul. */
export function istanbulDay(date: Date) {
  return Math.floor((date.getTime() + ISTANBUL_OFFSET_MS) / DAY_MS);
}

/** Calendar days from the due date (negative before, positive after). */
export function daysFromDue(dueDate: Date, now: Date) {
  return istanbulDay(now) - istanbulDay(dueDate);
}

export function stepKey(offsetDays: number) {
  return offsetDays < 0 ? `d${offsetDays}` : `d+${offsetDays}`;
}

export function reminderDedupeKey(invoiceId: string, step: string) {
  return `invoice.reminder:${invoiceId}:${step}`;
}

/** Old fixed "vade −3" reminder key: an invoice reminded before the switch isn't reminded again at −3. */
const legacyReminderKey = (invoiceId: string) => `invoice.reminder:${invoiceId}`;

export interface PlannedReminder {
  step: string;
  offsetDays: number;
  template: "billing.invoice-reminder" | "billing.invoice-overdue" | "billing.invoice-final-warning";
  channels: NotificationChannel[];
}

/**
 * What the schedule says for an invoice today (pure). The final warning wins
 * over a regular step on the same day.
 */
export function planReminder(
  schedule: ReminderSchedule,
  invoice: { dueDate: Date; suspendable: boolean },
  now: Date,
  graceDays: number
): PlannedReminder | null {
  const offset = daysFromDue(invoice.dueDate, now);
  const channels = (step: { email: boolean; sms: boolean }) =>
    [...(step.email ? (["EMAIL"] as const) : []), ...(step.sms ? (["SMS"] as const) : [])] as NotificationChannel[];

  const finalOffset = graceDays - 1;
  if (schedule.finalWarning.enabled && invoice.suspendable && finalOffset >= 0 && offset === finalOffset) {
    return { step: "final", offsetDays: offset, template: "billing.invoice-final-warning", channels: channels(schedule.finalWarning) };
  }

  const step = schedule.steps.find((item) => item.offsetDays === offset);
  if (!step) return null;
  return {
    step: stepKey(step.offsetDays),
    offsetDays: step.offsetDays,
    template: step.offsetDays < 0 ? "billing.invoice-reminder" : "billing.invoice-overdue",
    channels: channels(step),
  };
}

const invoiceSelect = {
  id: true,
  invoiceNumber: true,
  customerId: true,
  totalAmount: true,
  dueDate: true,
  createdAt: true,
  order: { select: { serviceId: true } },
} satisfies Prisma.InvoiceSelect;

/**
 * Hourly ("notifications" cron, 08–21): sends today's schedule step for every
 * open invoice. Idempotent per (invoice, step, channel) through the dedupe
 * key; a missed day is not caught up (yesterday's reminder would be stale).
 */
export async function runInvoiceReminderSchedule(now = new Date()) {
  const schedule = await getReminderSchedule();
  const { getSuspendGraceDays } = await import("@/lib/cron/jobs/suspend-overdue-services");
  const graceDays = await getSuspendGraceDays();

  const offsets = [...schedule.steps.map((step) => step.offsetDays), ...(schedule.finalWarning.enabled ? [graceDays - 1] : [])];
  if (offsets.length === 0) return { checked: 0, sent: 0, bySteps: {} };
  const minOffset = Math.min(...offsets);
  const maxOffset = Math.max(...offsets);

  // Due dates whose Istanbul day is within [today − maxOffset, today − minOffset].
  const today = istanbulDay(now);
  const dueFrom = new Date((today - maxOffset) * DAY_MS - ISTANBUL_OFFSET_MS);
  const dueTo = new Date((today - minOffset + 1) * DAY_MS - ISTANBUL_OFFSET_MS);

  const invoices = await db.invoice.findMany({
    where: { status: { in: ["PENDING", "OVERDUE"] }, dueDate: { gte: dueFrom, lt: dueTo } },
    select: invoiceSelect,
    orderBy: { dueDate: "asc" },
    take: 1000,
  });

  // Only an invoice whose own service is active can trigger a suspension
  // (same rule as suspendOverdueServices), so only those get the final warning.
  const serviceIds = [...new Set(invoices.map((invoice) => invoice.order?.serviceId).filter((id): id is string => Boolean(id)))];
  const activeServices = serviceIds.length
    ? new Set(
        (await db.service.findMany({ where: { id: { in: serviceIds }, status: "ACTIVE" }, select: { id: true } })).map(
          (service) => service.id
        )
      )
    : new Set<string>();

  const candidates = invoices
    .filter((invoice) => !isZero(invoice.totalAmount))
    .map((invoice) => ({
      invoice,
      plan: planReminder(
        schedule,
        { dueDate: invoice.dueDate, suspendable: Boolean(invoice.order?.serviceId && activeServices.has(invoice.order.serviceId)) },
        now,
        graceDays
      ),
    }))
    .filter((item): item is { invoice: (typeof invoices)[number]; plan: PlannedReminder } => item.plan !== null)
    // Before the due date: an invoice created in the last 24 h just got "fatura oluştu".
    .filter(({ invoice, plan }) => plan.offsetDays >= 0 || invoice.createdAt.getTime() < now.getTime() - DAY_MS);

  if (candidates.length === 0) return { checked: invoices.length, sent: 0, bySteps: {} };

  // Recent invoice notices (any step, "oluştu", "gecikti"): one schedule notice per invoice per ~day.
  const ids = candidates.map(({ invoice }) => invoice.id);
  const recent = await db.notificationLog.findMany({
    where: {
      dedupeKey: { startsWith: "invoice." },
      OR: ids.flatMap((id) => [
        { dedupeKey: { startsWith: `invoice.reminder:${id}` } },
        { dedupeKey: { in: [`invoice.created:${id}`, `invoice.overdue:${id}`] } },
      ]),
    },
    select: { dedupeKey: true, createdAt: true },
  });
  const sentKeys = new Set(recent.map((row) => row.dedupeKey));
  const recentlyNotified = new Set(
    recent
      .filter((row) => row.createdAt.getTime() > now.getTime() - QUIET_MS)
      .map((row) => row.dedupeKey?.split(":")[1])
      .filter(Boolean)
  );

  const bySteps: Record<string, number> = {};
  let sent = 0;
  const suspendAt = (dueDate: Date) => new Date((istanbulDay(dueDate) + graceDays) * DAY_MS - ISTANBUL_OFFSET_MS);

  for (const { invoice, plan } of candidates) {
    const dedupeKey = reminderDedupeKey(invoice.id, plan.step);
    if (sentKeys.has(dedupeKey)) continue;
    if (plan.offsetDays === -3 && sentKeys.has(legacyReminderKey(invoice.id))) continue;
    if (recentlyNotified.has(invoice.id)) continue;

    const data = {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      totalAmount: invoice.totalAmount.toString(),
      dueDate: invoice.dueDate,
      ...(plan.template === "billing.invoice-reminder" ? { daysLeft: -plan.offsetDays } : {}),
      ...(plan.template === "billing.invoice-overdue" ? { suspendAfterDays: graceDays } : {}),
      ...(plan.template === "billing.invoice-final-warning" ? { suspendAt: suspendAt(invoice.dueDate) } : {}),
    };

    let queued = false;
    for (const channel of plan.channels) {
      const result = await sendNotification({
        userId: invoice.customerId,
        template: plan.template,
        data: data as never,
        channel,
        dedupeKey,
      });
      if (result.logIds.length > 0) queued = true;
      if (!result.ok) log.error("reminder not queued", { invoiceId: invoice.id, step: plan.step, channel, error: result.error });
    }
    if (queued) {
      sent += 1;
      bySteps[plan.step] = (bySteps[plan.step] ?? 0) + 1;
    }
  }

  log.info("invoice reminder schedule run", { checked: invoices.length, sent, bySteps });
  return { checked: invoices.length, sent, bySteps };
}
