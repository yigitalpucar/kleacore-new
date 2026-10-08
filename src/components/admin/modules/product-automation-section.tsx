"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { CheckCircle2, Loader2, RefreshCcw, Save, XCircle } from "lucide-react";
import { FormField, FormSection, appButton } from "@/components/app";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  checkProductPackagesAction,
  saveProductModuleBindingAction,
  type ProductPackageCheck,
} from "@/lib/actions/admin/modules";
import type { ProductBindingOption } from "@/lib/modules/admin-view";
import { toast } from "@/lib/toast";
import { SchemaFields, initialSchemaValues } from "./schema-fields";

const NONE = "__none__";

/**
 * Product edit → "Otomasyon": which module instance provisions the product
 * and its module options (form generated from productOptionsSchema).
 * Saves independently of the main product form.
 */
export function ProductAutomationSection({
  productId,
  categoryName,
  current,
  options,
}: {
  productId: string;
  categoryName: string;
  current: { moduleInstanceId: string | null; moduleOptions: Record<string, unknown> };
  options: ProductBindingOption[];
}) {
  const router = useRouter();
  const [instanceId, setInstanceId] = useState(current.moduleInstanceId ?? NONE);
  const selected = useMemo(() => options.find((option) => option.instanceId === instanceId) ?? null, [options, instanceId]);
  const [valuesByModule, setValuesByModule] = useState<Record<string, ReturnType<typeof initialSchemaValues>>>(() => {
    const initial: Record<string, ReturnType<typeof initialSchemaValues>> = {};
    for (const option of options) {
      const isCurrent = option.instanceId === current.moduleInstanceId;
      initial[option.moduleId] ??= initialSchemaValues(option.optionFields, isCurrent ? current.moduleOptions : {});
      if (isCurrent) initial[option.moduleId] = initialSchemaValues(option.optionFields, current.moduleOptions);
    }
    return initial;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const values = selected ? (valuesByModule[selected.moduleId] ?? {}) : {};
  const [packageCheck, setPackageCheck] = useState<ProductPackageCheck | null>(null);
  const [checking, setChecking] = useState(false);

  // Read-only listpkgs through the selected instance + check of the resolved package name.
  const runPackageCheck = useCallback(
    async (instance: ProductBindingOption, formValues: typeof values) => {
      setChecking(true);
      const result = await checkProductPackagesAction(productId, { moduleInstanceId: instance.instanceId, values: formValues });
      setChecking(false);
      if (!result.success) {
        setPackageCheck({ supported: true, packages: [], resolved: null, exists: null, error: result.error });
        return;
      }
      setPackageCheck(result.check);
    },
    [productId]
  );

  const selectedId = selected?.listsPackages ? selected.instanceId : null;
  useEffect(() => {
    setPackageCheck(null);
    if (!selectedId) return;
    const instance = options.find((option) => option.instanceId === selectedId);
    if (instance) void runPackageCheck(instance, valuesByModule[instance.moduleId] ?? {});
    // Only when the selected instance changes; value edits re-check via the button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const pickPackage = (name: string) => {
    if (!selected) return;
    const next = { ...values, package: name };
    setValuesByModule((prev) => ({ ...prev, [selected.moduleId]: next }));
    void runPackageCheck(selected, next);
  };

  const save = () =>
    start(async () => {
      setErrors({});
      const result = await saveProductModuleBindingAction(productId, {
        moduleInstanceId: selected?.instanceId ?? null,
        values,
      });
      if (!result.success) {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
        return;
      }
      toast.success(selected ? `Ürün “${selected.label}” örneğine bağlandı.` : "Otomasyon bağlantısı kaldırıldı.");
      if (result.warning) toast.info(result.warning);
      router.refresh();
    });

  return (
    <FormSection
      title="Otomasyon"
      description={
        <>
          Ödeme sonrası hizmetin hangi modül örneğinde açılacağı. Bağlantı yoksa eski kurallar geçerlidir (kategoriye göre
          WHM veya elle kurulum görevi). Örnekler{" "}
          <Link href="/yonetim/moduller" className="underline underline-offset-2">
            Modüller
          </Link>{" "}
          ekranında yönetilir.
        </>
      }
      footer={
        <button type="button" onClick={save} disabled={pending} className={appButton({ size: "sm" })}>
          {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Save aria-hidden />}
          Otomasyonu kaydet
        </button>
      }
    >
      <FormField
        label="Modül örneği"
        htmlFor="automation-instance"
        hint={
          options.length
            ? selected?.groupKey
              ? `“${selected.groupKey}” grubundaki en az dolu aktif sunucu seçilir.`
              : undefined
            : `${categoryName} kategorisine bağlanabilecek aktif sunucu modülü örneği yok.`
        }
      >
        <Select value={instanceId} onValueChange={setInstanceId}>
          <SelectTrigger id="automation-instance" className="h-11 md:h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Otomasyon yok (eski kurallar / elle kurulum)</SelectItem>
            {options.map((option) => (
              <SelectItem key={option.instanceId} value={option.instanceId}>
                {option.label} · {option.moduleName}
                {option.isActive ? "" : " (pasif)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      {selected && selected.optionFields.length ? (
        <SchemaFields
          fields={selected.optionFields}
          values={values}
          onChange={(next) => setValuesByModule((prev) => ({ ...prev, [selected.moduleId]: next }))}
          errors={errors}
          idPrefix={`automation-${selected.moduleId}`}
        />
      ) : null}

      {selected?.listsPackages ? (
        <div className="space-y-3 rounded-md border p-3 text-sm md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">Sunucudaki paketler</p>
            <button
              type="button"
              onClick={() => void runPackageCheck(selected, values)}
              disabled={checking}
              className={appButton({ variant: "ghost", size: "sm" })}
            >
              {checking ? <Loader2 aria-hidden className="animate-spin" /> : <RefreshCcw aria-hidden />}
              Paketi kontrol et
            </button>
          </div>
          {checking && !packageCheck ? (
            <p className="text-muted-foreground">Paketler sunucudan okunuyor…</p>
          ) : packageCheck?.error ? (
            <p className="text-muted-foreground" role="status">
              Paketler alınamadı: {packageCheck.error}
            </p>
          ) : packageCheck ? (
            <>
              {packageCheck.resolved ? (
                <p className="flex items-center gap-2" role="status">
                  {packageCheck.exists ? (
                    <CheckCircle2 aria-hidden className="size-4 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle aria-hidden className="size-4 shrink-0 text-red-600" />
                  )}
                  <span>
                    Kurulumda kullanılacak paket: <span className="font-mono">{packageCheck.resolved}</span>
                    {packageCheck.exists ? "" : " — bu sunucuda yok"}
                  </span>
                </p>
              ) : null}
              {packageCheck.packages.length ? (
                <ul className="flex flex-wrap gap-1.5" aria-label="Sunucudaki paketler">
                  {packageCheck.packages.map((pkg) => (
                    <li key={pkg.name}>
                      <button
                        type="button"
                        onClick={() => pickPackage(pkg.name)}
                        className="rounded border px-2 py-1 font-mono text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        title="Bu paketi seç"
                      >
                        {pkg.name}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">Bu hesapla görülebilen paket yok.</p>
              )}
            </>
          ) : null}
        </div>
      ) : null}
    </FormSection>
  );
}
