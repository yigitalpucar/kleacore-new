"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Link2Off, Loader2, PlugZap, Save, Trash2 } from "lucide-react";
import { FormField, FormSection, PageHeader, SectionCard, StatusBadge, appButton } from "@/components/app";
import { HealthBadge } from "@/components/admin/modules/health-badge";
import { SchemaFields, initialSchemaValues } from "@/components/admin/modules/schema-fields";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  deleteModuleInstanceAction,
  saveModuleInstanceAction,
  testModuleInstanceAction,
  unlinkLegacyModuleInstanceAction,
} from "@/lib/actions/admin/modules";
import type { InstanceFormView } from "@/lib/modules/admin-view";
import { MODULE_KIND_LABELS } from "@/lib/modules/types";
import { toast } from "@/lib/toast";

const control = "h-11 md:h-9";
const LEGACY_TABS: Record<string, string> = { cpanel: "cpanel", registrar: "registrar", vps_vds: "vps-vds" };

export function ModuleInstanceForm({ view }: { view: InstanceFormView }) {
  const router = useRouter();
  const { manifest, instance } = view;
  const isNew = !instance;
  const legacy = instance?.legacySource ?? null;

  const [label, setLabel] = useState(instance?.label ?? manifest.name);
  const [isActive, setIsActive] = useState(instance?.isActive ?? true);
  const [priority, setPriority] = useState(String(instance?.priority ?? 0));
  const [groupKey, setGroupKey] = useState(instance?.groupKey ?? "");
  const [capacity, setCapacity] = useState(instance?.capacity ? String(instance.capacity) : "");
  const [values, setValues] = useState(() => initialSchemaValues(view.fields, view.values));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, startSave] = useTransition();
  const [busy, startBusy] = useTransition();

  const save = () =>
    startSave(async () => {
      setErrors({});
      const result = await saveModuleInstanceAction({
        id: instance?.id,
        moduleId: manifest.id,
        label,
        values,
        isActive,
        priority,
        groupKey,
        capacity,
      });
      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(isNew ? "Modül örneği oluşturuldu. Bağlantıyı test edin." : "Modül örneği kaydedildi.");
      if (isNew) router.push(`/yonetim/moduller/${result.id}`);
      else router.refresh();
    });

  const test = () =>
    startBusy(async () => {
      if (!instance) return;
      const result = await testModuleInstanceAction(instance.id);
      if (result.ok) toast.success(result.message);
      else toast.error(result.message);
      router.refresh();
    });

  const unlink = () =>
    startBusy(async () => {
      if (!instance || !window.confirm("Bu örnek artık Entegrasyonlar ekranındaki ayarları izlemeyecek. Devam edilsin mi?")) return;
      const result = await unlinkLegacyModuleInstanceAction(instance.id);
      if (!result.success) toast.error(result.error);
      else toast.success("Bağlantı koparıldı; ayarları buradan düzenleyebilirsiniz.");
      router.refresh();
    });

  const remove = () =>
    startBusy(async () => {
      if (!instance || !window.confirm(`“${instance.label}” silinsin mi?`)) return;
      const result = await deleteModuleInstanceAction(instance.id);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Modül örneği silindi.");
      router.push("/yonetim/moduller");
    });

  const saveButton = (
    <button type="button" onClick={save} disabled={saving} className={appButton()}>
      {saving ? <Loader2 aria-hidden className="animate-spin" /> : <Save aria-hidden />}
      {saving ? "Kaydediliyor…" : isNew ? "Oluştur" : "Kaydet"}
    </button>
  );

  return (
    <>
      <PageHeader
        back={{ href: "/yonetim/moduller", label: "Modüller" }}
        eyebrow={`${MODULE_KIND_LABELS[manifest.kind]} · ${manifest.name}`}
        title={isNew ? `Yeni ${manifest.name} örneği` : instance.label}
        description={manifest.description}
        meta={
          instance ? (
            <span className="flex flex-wrap items-center gap-2">
              {instance.isActive ? <StatusBadge tone="success" label="Aktif" /> : <StatusBadge tone="muted" label="Pasif" />}
              <HealthBadge status={instance.lastHealthStatus} error={instance.lastHealthError} at={instance.lastHealthAt} />
            </span>
          ) : undefined
        }
        actions={
          instance ? (
            <>
              <button type="button" onClick={test} disabled={busy} className={appButton({ variant: "outline" })}>
                {busy ? <Loader2 aria-hidden className="animate-spin" /> : <PlugZap aria-hidden />}
                Bağlantıyı test et
              </button>
              {saveButton}
            </>
          ) : (
            saveButton
          )
        }
      />

      {instance?.lastHealthStatus === "ERROR" && instance.lastHealthError ? (
        <p role="alert" className="rounded-md border border-dashed px-4 py-3 text-sm">
          Son bağlantı testi başarısız: <span className="font-mono text-xs">{instance.lastHealthError}</span>
        </p>
      ) : null}

      <div className="space-y-8">
        <FormSection
          title="Genel"
          description="Pasif örneğe yeni hizmet açılmaz; mevcut hizmetlerin işlemleri (askı, kapatma) yine bu örnek üzerinden yürür."
        >
          <div className="grid gap-5 md:grid-cols-2">
            <FormField label="Etiket" htmlFor="instance-label" required error={errors.label} className="md:col-span-2">
              <Input id="instance-label" className={control} value={label} onChange={(e) => setLabel(e.target.value)} />
            </FormField>
            <FormField
              label="Öncelik"
              htmlFor="instance-priority"
              hint="Küçük değer önce seçilir (eşit doluluktaki sunucular arasında)."
              error={errors.priority}
            >
              <Input
                id="instance-priority"
                className={control}
                inputMode="numeric"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              />
            </FormField>
            <FormField
              label="Kapasite"
              htmlFor="instance-capacity"
              hint="En fazla hizmet (hesap/VM). Boş = sınırsız; dolu örneğe yeni hizmet açılmaz."
              error={errors.capacity}
            >
              <Input
                id="instance-capacity"
                className={control}
                inputMode="numeric"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
            </FormField>
            {manifest.kind === "server" ? (
              <FormField
                label="Sunucu grubu"
                htmlFor="instance-group"
                hint="Aynı gruptaki aynı modül örnekleri bir havuz oluşturur; ürün bu havuzdaki en az dolu sunucuya kurulur."
                className="md:col-span-2"
              >
                <Input
                  id="instance-group"
                  className={control}
                  placeholder="ör. whm-tr"
                  value={groupKey}
                  onChange={(e) => setGroupKey(e.target.value)}
                />
              </FormField>
            ) : null}
            <div className="flex items-start justify-between gap-4 md:col-span-2">
              <div className="space-y-0.5">
                <label htmlFor="instance-active" className="text-sm font-medium leading-none">
                  Aktif
                </label>
                <p className="text-xs text-muted-foreground">Yeni hizmetler için kullanılabilir.</p>
              </div>
              <Switch id="instance-active" checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Bağlantı ayarları"
          description={
            legacy ? (
              <>
                Bu örnek{" "}
                <Link className="underline underline-offset-2" href={`/yonetim/entegrasyonlar?tab=${LEGACY_TABS[legacy] ?? "overview"}`}>
                  Entegrasyonlar
                </Link>{" "}
                ekranındaki ayarlardan beslenir; oradaki her kayıt burayı günceller.
              </>
            ) : (
              "Gizli alanlar şifreli saklanır ve bir daha gösterilmez."
            )
          }
          footer={
            legacy ? (
              <button type="button" onClick={unlink} disabled={busy} className={appButton({ variant: "outline", size: "sm" })}>
                <Link2Off aria-hidden />
                Entegrasyonlar bağlantısını kopar
              </button>
            ) : undefined
          }
        >
          {view.fields.length ? (
            <SchemaFields
              fields={view.fields}
              values={values}
              onChange={setValues}
              errors={errors}
              idPrefix="config"
              disabled={Boolean(legacy)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Bu modülün ayarı yok.</p>
          )}
        </FormSection>

        {instance ? (
          <SectionCard
            title="Bağlı kayıtlar"
            description={`${instance.productCount} ürün · ${instance.serviceCount} hizmet`}
            footer={
              <button type="button" onClick={remove} disabled={busy} className={appButton({ variant: "ghost", size: "sm" })}>
                <Trash2 aria-hidden />
                Örneği sil
              </button>
            }
          >
            {view.bound.products.length || view.bound.servers.length ? (
              <ul className="space-y-1 text-sm">
                {view.bound.products.map((product) => (
                  <li key={product.id}>
                    <Link className="underline-offset-2 hover:underline" href={`/yonetim/urunler/paketler/${product.id}`}>
                      {product.name}
                    </Link>{" "}
                    <span className="font-mono text-xs text-muted-foreground">{product.sku}</span>
                  </li>
                ))}
                {view.bound.servers.map((server) => (
                  <li key={server.id}>
                    <Link className="underline-offset-2 hover:underline" href={`/yonetim/sunucular/${server.id}`}>
                      {server.name}
                    </Link>{" "}
                    <span className="font-mono text-xs text-muted-foreground">{server.hostname}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Henüz bu örneğe bağlı ürün yok. Ürün düzenleme ekranındaki “Otomasyon” bölümünden bağlayabilirsiniz.
              </p>
            )}
          </SectionCard>
        ) : null}
      </div>
    </>
  );
}
