"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, FormSection, appButton } from "@/components/app";
import { createIncident, updateIncident } from "@/lib/actions/admin/system-status";
import { toast } from "@/lib/toast";
import {
  EnumSelect,
  SEVERITY_HINT,
  SEVERITY_OPTIONS,
  fieldClass,
  fromLocalInput,
  incidentStatusOptions,
  toLocalInput,
  type IncidentRow,
} from "./shared";

type Severity = "MINOR" | "MAJOR" | "CRITICAL";
type IncidentStatus = "INVESTIGATING" | "IDENTIFIED" | "MONITORING" | "RESOLVED";

/**
 * Create (no `incident`) or edit the details of an incident. Status changes
 * on an existing incident go through the timeline form instead.
 */
export function IncidentForm({
  components,
  incident,
  defaultComponent,
}: {
  components: string[];
  incident?: IncidentRow;
  defaultComponent?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const isEdit = Boolean(incident);
  const [title, setTitle] = useState(incident?.title ?? "");
  const [serviceName, setServiceName] = useState(incident?.serviceName ?? defaultComponent ?? components[0] ?? "");
  const [severity, setSeverity] = useState<string>(incident?.severity ?? "MINOR");
  const [status, setStatus] = useState<string>("INVESTIGATING");
  const [startedAt, setStartedAt] = useState(toLocalInput(incident?.startedAt));
  const [description, setDescription] = useState(incident?.description ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Keep a renamed/deleted component selectable when editing old incidents.
  const componentOptions = [...new Set([...components, ...(incident ? [incident.serviceName] : [])])].map((c) => ({
    value: c,
    label: c,
  }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const base = {
      title,
      description,
      severity: severity as Severity,
      serviceName,
      startedAt: fromLocalInput(startedAt),
    };
    start(async () => {
      if (incident) {
        const res = await updateIncident(incident.id, base);
        if (!res.success) return setError(res.error);
        toast.success("Olay bilgileri güncellendi");
        router.refresh();
        return;
      }
      const res = await createIncident({ ...base, status: status as IncidentStatus, message });
      if (!res.success) return setError(res.error);
      toast.success("Olay yayımlandı");
      router.push(res.data ? `/yonetim/durum/olaylar/${res.data.id}` : "/yonetim/durum");
    });
  };

  const submitLabel = isEdit ? "Değişiklikleri kaydet" : "Olayı yayımla";

  return (
    <form onSubmit={submit} className="space-y-8">
      <FormSection
        title="Olay"
        description={
          isEdit
            ? "Başlık, etki ve bileşen herkese açık durum sayfasında hemen güncellenir."
            : "Yayımladığınız anda herkese açık durum sayfasında görünür."
        }
        footer={
          isEdit ? (
            <SubmitRow pending={pending} label={submitLabel} error={error} />
          ) : undefined
        }
      >
        <FormField label="Başlık" htmlFor="inc-title" required hint="Müşterinin anlayacağı kısa bir özet. Örn. “E-posta gönderiminde gecikme”">
          <Input id="inc-title" value={title} onChange={(e) => setTitle(e.target.value)} className={fieldClass} maxLength={160} required />
        </FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Etkilenen bileşen" htmlFor="inc-component" required>
            {componentOptions.length ? (
              <EnumSelect id="inc-component" value={serviceName} onChange={setServiceName} options={componentOptions} placeholder="Bileşen seçin" />
            ) : (
              <p className="rounded-md border border-dashed px-3 py-2.5 text-sm text-muted-foreground">
                Önce <Link href="/yonetim/durum" className="underline underline-offset-2">bileşen ekleyin</Link>.
              </p>
            )}
          </FormField>
          <FormField label="Etki" htmlFor="inc-severity" hint={SEVERITY_HINT[severity]}>
            <EnumSelect id="inc-severity" value={severity} onChange={setSeverity} options={SEVERITY_OPTIONS} />
          </FormField>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          {!isEdit ? (
            <FormField label="Durum" htmlFor="inc-status">
              <EnumSelect id="inc-status" value={status} onChange={setStatus} options={incidentStatusOptions()} withDots kind="incident" />
            </FormField>
          ) : null}
          <FormField label="Başlangıç" htmlFor="inc-start" hint={isEdit ? undefined : "Boş bırakılırsa şu an."}>
            <Input id="inc-start" type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} className={fieldClass} />
          </FormField>
        </div>
        <FormField label="Açıklama" htmlFor="inc-description" hint="Olay kartında başlığın altında görünür.">
          <Textarea id="inc-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={2000} />
        </FormField>
      </FormSection>

      {!isEdit ? (
        <FormSection
          title="İlk güncelleme"
          description="Zaman çizelgesinin ilk kaydı. Boş bırakırsanız açıklama kullanılır."
          footer={<SubmitRow pending={pending} label={submitLabel} error={error} cancelHref="/yonetim/durum" />}
        >
          <FormField label="Güncelleme metni" htmlFor="inc-message">
            <Textarea
              id="inc-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Sorunu inceliyoruz. Gelişmeleri bu sayfadan paylaşacağız."
            />
          </FormField>
        </FormSection>
      ) : null}
    </form>
  );
}

function SubmitRow({ pending, label, error, cancelHref }: { pending: boolean; label: string; error: string | null; cancelHref?: string }) {
  return (
    <>
      {error ? (
        <p role="alert" className="mr-auto text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      {cancelHref ? (
        <Link href={cancelHref} className={appButton({ variant: "outline" })}>
          Vazgeç
        </Link>
      ) : null}
      <button type="submit" disabled={pending} className={appButton()}>
        {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
        {label}
      </button>
    </>
  );
}
