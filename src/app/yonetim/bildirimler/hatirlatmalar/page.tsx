import type { Metadata } from "next";
import { PageHeader } from "@/components/app";
import { getSuspendGraceDays } from "@/lib/cron/jobs/suspend-overdue-services";
import { DEFAULT_REMINDER_SCHEDULE, getReminderSchedule } from "@/lib/notifications/reminder-schedule";
import { ReminderScheduleForm } from "./schedule-form";
import { requirePermission } from "@/lib/utils/auth-helpers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Hatırlatma takvimi" };

export default async function HatirlatmalarPage() {
  await requirePermission("settings.manage");
  const [schedule, graceDays] = await Promise.all([getReminderSchedule(), getSuspendGraceDays()]);
  return (
    <>
      <PageHeader
        back={{ href: "/yonetim/bildirimler", label: "Bildirimler" }}
        title="Fatura hatırlatma takvimi"
        description="Ödenmemiş faturalar için vade öncesi ve sonrası hatırlatmalar. Her adım, faturanın son ödeme gününe göre (İstanbul saatiyle) o gün saat başı çalışan görevde bir kez gönderilir; aynı fatura için aynı adım asla iki kez gitmez."
      />
      <ReminderScheduleForm initial={schedule} defaults={DEFAULT_REMINDER_SCHEDULE} graceDays={graceDays} />
    </>
  );
}
