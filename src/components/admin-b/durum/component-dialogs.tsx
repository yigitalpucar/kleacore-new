"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField, appButton } from "@/components/app";
import { CatalogDialog } from "@/components/admin-b/katalog/catalog-dialog";
import {
  createStatusComponent,
  deleteStatusComponent,
  scheduleComponentMaintenance,
  updateStatusComponent,
} from "@/lib/actions/admin/system-status";
import { toast } from "@/lib/toast";
import { EnumSelect, componentStatusOptions, fieldClass, fromLocalInput, type ComponentRow } from "./shared";

export type ComponentDialogMode =
  | { kind: "create" }
  | { kind: "edit"; row: ComponentRow }
  | { kind: "maintenance"; row: ComponentRow }
  | { kind: "delete"; row: ComponentRow }
  | null;

/** Create / edit / maintenance / delete dialogs for status page components. */
export function ComponentDialogs({ mode, onClose }: { mode: ComponentDialogMode; onClose: () => void }) {
  if (mode?.kind === "create" || mode?.kind === "edit") {
    const row = mode.kind === "edit" ? mode.row : null;
    return <ComponentForm key={row?.id ?? "new"} row={row} onDone={onClose} />;
  }
  if (mode?.kind === "maintenance") return <MaintenanceForm key={mode.row.id} row={mode.row} onDone={onClose} />;
  if (mode?.kind === "delete") return <DeleteComponent key={mode.row.id} row={mode.row} onDone={onClose} />;
  return null;
}

function ErrorText({ error }: { error: string | null }) {
  return error ? (
    <p role="alert" className="text-sm text-red-600 dark:text-red-400">
      {error}
    </p>
  ) : null;
}

function Footer({
  pending,
  label,
  onCancel,
  form,
  onConfirm,
  destructive,
}: {
  pending: boolean;
  label: string;
  onCancel: () => void;
  form?: string;
  onConfirm?: () => void;
  destructive?: boolean;
}) {
  return (
    <>
      <button type="button" onClick={onCancel} className={appButton({ variant: "outline" })}>
        Vazgeç
      </button>
      <button
        type={form ? "submit" : "button"}
        form={form}
        onClick={onConfirm}
        disabled={pending}
        className={appButton({ variant: destructive ? "destructive" : "primary" })}
      >
        {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
        {label}
      </button>
    </>
  );
}

function ComponentForm({ row, onDone }: { row: ComponentRow | null; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [serviceName, setServiceName] = useState(row?.serviceName ?? "");
  const [status, setStatus] = useState(row?.status ?? "OPERATIONAL");
  const [description, setDescription] = useState(row?.description ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const input = { serviceName, status: status as "OPERATIONAL", description };
      const res = row ? await updateStatusComponent(row.id, input) : await createStatusComponent(input);
      if (!res.success) return setError(res.error);
      toast.success(row ? "Bileşen güncellendi" : "Bileşen eklendi");
      onDone();
      router.refresh();
    });
  };

  return (
    <CatalogDialog
      open
      onOpenChange={(o) => (!o ? onDone() : undefined)}
      title={row ? "Bileşeni düzenle" : "Bileşen ekle"}
      description="Bileşenler durum sayfasında ada göre sıralanır. Olaylar bileşene adıyla bağlanır; adı değiştirirseniz olaylar da taşınır."
      footer={<Footer pending={pending} label={row ? "Kaydet" : "Ekle"} onCancel={onDone} form="component-form" />}
    >
      <form id="component-form" onSubmit={submit} className="space-y-5">
        <FormField label="Bileşen adı" htmlFor="component-name" required hint="Örn. Web Hosting, DNS, E-posta">
          <Input
            id="component-name"
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
            className={fieldClass}
            maxLength={80}
            required
            autoFocus
          />
        </FormField>
        <FormField label="Durum" htmlFor="component-status">
          <EnumSelect id="component-status" value={status} onChange={setStatus} options={componentStatusOptions()} withDots kind="systemStatus" />
        </FormField>
        <FormField label="Açıklama" htmlFor="component-description" hint="Durum sayfasında bileşenin altında görünür. En fazla 500 karakter.">
          <Textarea id="component-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500} />
        </FormField>
        <ErrorText error={error} />
      </form>
    </CatalogDialog>
  );
}

function MaintenanceForm({ row, onDone }: { row: ComponentRow; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const s = fromLocalInput(startAt);
    const en = fromLocalInput(endAt);
    if (!s || !en) return setError("Başlangıç ve bitiş zamanını giriniz");
    start(async () => {
      const res = await scheduleComponentMaintenance(row.id, { start: s, end: en, note });
      if (!res.success) return setError(res.error);
      toast.success(`${row.serviceName} bakım moduna alındı`);
      onDone();
      router.refresh();
    });
  };

  return (
    <CatalogDialog
      open
      onOpenChange={(o) => (!o ? onDone() : undefined)}
      title={`Bakım duyurusu · ${row.serviceName}`}
      description="Bileşen hemen “Bakımda” durumuna alınır ve bakım penceresi açıklamasına yazılır. Bakım bitince durumu “Çalışıyor” yapın; otomatik geri dönüş yoktur."
      footer={<Footer pending={pending} label="Bakımı duyur" onCancel={onDone} form="maintenance-form" />}
    >
      <form id="maintenance-form" onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Başlangıç" htmlFor="mnt-start" required>
            <Input id="mnt-start" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className={fieldClass} required />
          </FormField>
          <FormField label="Bitiş" htmlFor="mnt-end" required>
            <Input id="mnt-end" type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} className={fieldClass} required />
          </FormField>
        </div>
        <FormField label="Not" htmlFor="mnt-note" hint="İsteğe bağlı. Örn. “Kısa süreli bağlantı kesintileri yaşanabilir.”">
          <Textarea id="mnt-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={300} />
        </FormField>
        <ErrorText error={error} />
      </form>
    </CatalogDialog>
  );
}

function DeleteComponent({ row, onDone }: { row: ComponentRow; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const confirm = () =>
    start(async () => {
      const res = await deleteStatusComponent(row.id);
      if (!res.success) return setError(res.error);
      toast.success("Bileşen silindi");
      onDone();
      router.refresh();
    });

  return (
    <CatalogDialog
      open
      onOpenChange={(o) => (!o ? onDone() : undefined)}
      title="Bileşen silinsin mi?"
      description={`“${row.serviceName}” durum sayfasından kaldırılır. Geçmiş olay kayıtları silinmez.`}
      footer={<Footer pending={pending} label="Sil" onCancel={onDone} onConfirm={confirm} destructive />}
    >
      {error ? <ErrorText error={error} /> : <p className="text-sm text-muted-foreground">Bu işlem geri alınamaz.</p>}
    </CatalogDialog>
  );
}
