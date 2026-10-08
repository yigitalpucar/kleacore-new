"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { CatalogDialog } from "@/components/admin-b/katalog/catalog-dialog";
import { Textarea } from "@/components/ui/textarea";
import { FormField, appButton } from "@/components/app";
import { addIncidentUpdate, deleteIncident } from "@/lib/actions/admin/system-status";
import { toast } from "@/lib/toast";
import { EnumSelect, incidentStatusOptions } from "./shared";

type IncidentStatus = "INVESTIGATING" | "IDENTIFIED" | "MONITORING" | "RESOLVED";

const NEXT_STATUS: Record<string, IncidentStatus> = {
  INVESTIGATING: "IDENTIFIED",
  IDENTIFIED: "MONITORING",
  MONITORING: "RESOLVED",
  RESOLVED: "RESOLVED",
};

const PLACEHOLDER: Record<string, string> = {
  INVESTIGATING: "Sorunu inceliyoruz.",
  IDENTIFIED: "Sorunun nedeni tespit edildi, düzeltme uygulanıyor.",
  MONITORING: "Düzeltme uygulandı, sistemi izliyoruz.",
  RESOLVED: "Sorun giderildi. Yaşanan aksaklık için özür dileriz.",
};

/** Timeline composer: new status + message. */
export function IncidentUpdateForm({ incidentId, currentStatus }: { incidentId: string; currentStatus: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<string>(NEXT_STATUS[currentStatus] ?? "INVESTIGATING");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await addIncidentUpdate(incidentId, { status: status as IncidentStatus, message });
      if (!res.success) return setError(res.error);
      setMessage("");
      toast.success(status === "RESOLVED" ? "Olay çözüldü olarak işaretlendi" : "Güncelleme yayımlandı");
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <FormField label="Yeni durum" htmlFor="upd-status">
        <EnumSelect id="upd-status" value={status} onChange={setStatus} options={incidentStatusOptions()} withDots kind="incident" />
      </FormField>
      <FormField label="Güncelleme" htmlFor="upd-message" required hint="Herkese açık sayfada zaman çizelgesine eklenir.">
        <Textarea
          id="upd-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder={PLACEHOLDER[status]}
          required
        />
      </FormField>
      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={appButton({ className: "w-full" })}>
        {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
        Güncellemeyi yayımla
      </button>
    </form>
  );
}

export function DeleteIncidentButton({ incidentId, title }: { incidentId: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const confirm = () =>
    start(async () => {
      const res = await deleteIncident(incidentId);
      if (!res.success) return setError(res.error);
      toast.success("Olay silindi");
      router.push("/yonetim/durum");
    });

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={appButton({ variant: "outline", className: "w-full" })}>
        <Trash2 aria-hidden />
        Olayı sil
      </button>
      <CatalogDialog
        open={open}
        onOpenChange={setOpen}
        title="Olay silinsin mi?"
        description={`“${title}” ve tüm güncellemeleri kalıcı olarak silinir ve olay geçmişinden kaldırılır.`}
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className={appButton({ variant: "outline" })}>
              Vazgeç
            </button>
            <button type="button" disabled={pending} onClick={confirm} className={appButton({ variant: "destructive" })}>
              {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
              Kalıcı olarak sil
            </button>
          </>
        }
      >
        {error ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Yalnızca hatalı açılmış kayıtlar için kullanın; gerçek olayları “Çözüldü” durumuyla kapatın ki geçmişte kalsın.
          </p>
        )}
      </CatalogDialog>
    </>
  );
}
