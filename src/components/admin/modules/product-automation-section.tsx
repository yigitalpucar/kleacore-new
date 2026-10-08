"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { FormField, FormSection, appButton } from "@/components/app";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveProductModuleBindingAction } from "@/lib/actions/admin/modules";
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
    </FormSection>
  );
}
