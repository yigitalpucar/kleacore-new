"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { DetailList, FormField, SectionCard, StatusBadge, appButton } from "@/components/app";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { assignServiceModuleAction } from "@/lib/actions/admin/modules";
import { toast } from "@/lib/toast";

const NONE = "__none__";

export interface ServiceModuleView {
  current: { id: string; label: string; moduleId: string; moduleName: string; isActive: boolean } | null;
  remoteId: string | null;
  choices: Array<{ id: string; label: string }>;
}

/**
 * Service detail → module binding: the instance the remote account lives on
 * and its remote id. Admins can link a legacy service (created before the
 * module registry) to its instance; this never touches the remote side.
 */
export function ServiceModuleCard({
  serviceId,
  view,
  legacyServerName,
}: {
  serviceId: string;
  view: ServiceModuleView;
  legacyServerName: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [instanceId, setInstanceId] = useState(view.current?.id ?? NONE);
  const [remoteId, setRemoteId] = useState(view.remoteId ?? "");
  const [error, setError] = useState<string | undefined>();
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      setError(undefined);
      const result = await assignServiceModuleAction(serviceId, {
        moduleInstanceId: instanceId === NONE ? null : instanceId,
        remoteId,
      });
      if (!result.success) {
        setError(result.fieldErrors?.remoteId ?? result.error);
        toast.error(result.error);
        return;
      }
      toast.success("Modül bağlantısı kaydedildi.");
      setEditing(false);
      router.refresh();
    });

  return (
    <SectionCard
      title="Otomasyon modülü"
      description={
        view.current
          ? "Askıya alma, kapatma ve paket değişikliği bu modül örneği üzerinden yapılır."
          : "Bu hizmet eski (kategoriye göre) entegrasyonla yönetiliyor."
      }
      actions={
        !editing && view.choices.length ? (
          <button type="button" className={appButton({ variant: "outline", size: "sm" })} onClick={() => setEditing(true)}>
            Bağlantıyı düzenle
          </button>
        ) : undefined
      }
      footer={
        editing ? (
          <>
            <button type="button" className={appButton({ variant: "ghost", size: "sm" })} onClick={() => setEditing(false)}>
              Vazgeç
            </button>
            <button type="button" className={appButton({ size: "sm" })} onClick={save} disabled={pending}>
              {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Save aria-hidden />}
              Kaydet
            </button>
          </>
        ) : undefined
      }
    >
      {editing ? (
        <div className="grid gap-5 md:grid-cols-2">
          <FormField
            label="Modül örneği"
            htmlFor="service-module-instance"
            hint="Uzak tarafta hiçbir şey değişmez; yalnızca kayıt eşleştirilir."
          >
            <Select value={instanceId} onValueChange={setInstanceId}>
              <SelectTrigger id="service-module-instance" className="h-11 md:h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Bağlı değil (eski entegrasyon)</SelectItem>
                {view.choices.map((choice) => (
                  <SelectItem key={choice.id} value={choice.id}>
                    {choice.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            label="Uzak kimlik"
            htmlFor="service-remote-id"
            hint="WHM kullanıcı adı / Proxmox VMID"
            error={error}
            required={instanceId !== NONE}
          >
            <Input
              id="service-remote-id"
              className="h-11 font-mono md:h-9"
              value={remoteId}
              disabled={instanceId === NONE}
              onChange={(event) => setRemoteId(event.target.value)}
            />
          </FormField>
        </div>
      ) : (
        <DetailList
          layout="grid"
          items={[
            {
              label: "Modül örneği",
              value: view.current ? (
                <span className="inline-flex flex-wrap items-center gap-2">
                  <Link className="underline-offset-2 hover:underline" href={`/yonetim/moduller/${view.current.id}`}>
                    {view.current.label}
                  </Link>
                  <span className="text-xs text-muted-foreground">{view.current.moduleName}</span>
                  {view.current.isActive ? null : <StatusBadge tone="muted" label="Pasif" />}
                </span>
              ) : (
                "—"
              ),
            },
            { label: "Uzak kimlik", value: view.remoteId, mono: true, copy: view.remoteId ?? undefined },
            { label: "Sunucu (eski kayıt)", value: legacyServerName, mono: true },
          ]}
        />
      )}
    </SectionCard>
  );
}
