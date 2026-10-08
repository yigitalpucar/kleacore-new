"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { EmptyState, FormSection, SectionCard, appButton } from "@/components/app";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { saveReminderScheduleAction } from "@/lib/actions/admin/reminder-schedule";
import type { ReminderSchedule } from "@/lib/notifications/reminder-schedule";
import { toast } from "@/lib/toast";

function describeOffset(offset: number) {
  if (offset < 0) return `Vadeden ${-offset} gün önce · "Ödeme hatırlatması"`;
  if (offset === 0) return "Vade günü · \"Fatura gecikti\"";
  return `Vadeden ${offset} gün sonra · "Fatura gecikti"`;
}

export function ReminderScheduleForm({
  initial,
  defaults,
  graceDays,
}: {
  initial: ReminderSchedule;
  defaults: ReminderSchedule;
  graceDays: number;
}) {
  const router = useRouter();
  const [schedule, setSchedule] = useState<ReminderSchedule>(initial);
  const [pending, startTransition] = useTransition();
  const finalOffset = graceDays - 1;

  const updateStep = (index: number, patch: Partial<ReminderSchedule["steps"][number]>) =>
    setSchedule((current) => ({
      ...current,
      steps: current.steps.map((step, i) => (i === index ? { ...step, ...patch } : step)),
    }));

  const addStep = () =>
    setSchedule((current) => {
      const used = new Set(current.steps.map((step) => step.offsetDays));
      let offset = 14;
      while (used.has(offset) && offset < 60) offset += 1;
      return { ...current, steps: [...current.steps, { offsetDays: offset, email: true, sms: false }] };
    });

  const save = () =>
    startTransition(async () => {
      const result = await saveReminderScheduleAction(schedule);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Hatırlatma takvimi kaydedildi");
      router.refresh();
    });

  const sorted = schedule.steps
    .map((step, index) => ({ step, index }))
    .sort((a, b) => a.step.offsetDays - b.step.offsetDays);

  return (
    <div className="space-y-6">
      <FormSection
        title="Adımlar"
        description="Gün: negatif sayı vadeden önce, pozitif sayı vadeden sonra. Vadeden önceki adımlar son 24 saatte oluşturulan faturalara gönderilmez (onlara az önce “fatura oluştu” gitti)."
      >
        {sorted.length === 0 ? (
          <EmptyState compact title="Adım yok" description="Hatırlatma gönderilmez; yalnızca “fatura gecikti” ve son uyarı gider." />
        ) : (
          <ul className="divide-y rounded-lg border">
            {sorted.map(({ step, index }) => (
              <li key={index} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <label className="sr-only" htmlFor={`offset-${index}`}>
                    Gün
                  </label>
                  <Input
                    id={`offset-${index}`}
                    type="number"
                    min={-30}
                    max={60}
                    step={1}
                    value={step.offsetDays}
                    onChange={(event) => updateStep(index, { offsetDays: Math.trunc(Number(event.target.value) || 0) })}
                    className="h-11 w-24 font-mono md:h-9"
                  />
                  <span className="min-w-0 text-sm text-muted-foreground">{describeOffset(step.offsetDays)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={step.email} onCheckedChange={(checked) => updateStep(index, { email: checked === true })} />
                    E-posta
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox checked={step.sms} onCheckedChange={(checked) => updateStep(index, { sms: checked === true })} />
                    SMS
                  </label>
                  <button
                    type="button"
                    aria-label="Adımı sil"
                    className={appButton({ variant: "ghost", size: "icon-sm" })}
                    onClick={() => setSchedule((current) => ({ ...current, steps: current.steps.filter((_, i) => i !== index) }))}
                  >
                    <Trash2 aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3">
          <button type="button" onClick={addStep} disabled={schedule.steps.length >= 10} className={appButton({ variant: "outline", size: "sm" })}>
            <Plus aria-hidden />
            Adım ekle
          </button>
        </div>
      </FormSection>

      <FormSection
        title="Askıya alma öncesi son uyarı"
        description={`Hizmetler vadeden ${graceDays} gün sonra askıya alınır (Ayarlar → askı süresi). Son uyarı bundan bir gün önce, vade + ${finalOffset}. günde, yalnızca askıya alınacak aktif hizmeti olan faturalara gider.`}
      >
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox
              checked={schedule.finalWarning.enabled}
              onCheckedChange={(checked) => setSchedule((current) => ({ ...current, finalWarning: { ...current.finalWarning, enabled: checked === true } }))}
            />
            Son uyarıyı gönder
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={schedule.finalWarning.email}
              disabled={!schedule.finalWarning.enabled}
              onCheckedChange={(checked) => setSchedule((current) => ({ ...current, finalWarning: { ...current.finalWarning, email: checked === true } }))}
            />
            E-posta
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={schedule.finalWarning.sms}
              disabled={!schedule.finalWarning.enabled}
              onCheckedChange={(checked) => setSchedule((current) => ({ ...current, finalWarning: { ...current.finalWarning, sms: checked === true } }))}
            />
            SMS
          </label>
        </div>
        {schedule.steps.some((step) => step.offsetDays === finalOffset) && schedule.finalWarning.enabled ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Vade + {finalOffset}. gündeki adım, askıya alınacak hizmeti olan faturalarda son uyarıyla değiştirilir.
          </p>
        ) : null}
      </FormSection>

      <SectionCard
        title="Notlar"
        headingLevel={3}
        footer={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={save} disabled={pending} className={appButton({ variant: "primary", size: "sm" })}>
              <Save aria-hidden />
              Kaydet
            </button>
            <button type="button" onClick={() => setSchedule(defaults)} disabled={pending} className={appButton({ variant: "ghost", size: "sm" })}>
              <RotateCcw aria-hidden />
              Varsayılan takvim
            </button>
          </div>
        }
      >
        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          <li>SMS yalnızca SMS bildirimleri açık ve sağlayıcı yapılandırılmışsa ve müşterinin telefonu kayıtlıysa gider.</li>
          <li>Aynı fatura için 20 saat içinde ikinci bir hatırlatma gönderilmez (ör. “fatura gecikti” ile aynı gün).</li>
          <li>
            Metinleri <Link href="/yonetim/bildirimler/sablonlar?t=billing.invoice-reminder" className="underline">şablonlardan</Link> düzenleyebilirsiniz: ödeme hatırlatması, fatura gecikti, son uyarı.
          </li>
        </ul>
      </SectionCard>
    </div>
  );
}
