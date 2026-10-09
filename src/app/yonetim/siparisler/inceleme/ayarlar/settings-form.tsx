"use client";

import { useState, useTransition } from "react";
import { Save } from "lucide-react";
import { FormField, FormSection, appButton } from "@/components/app";
import { Input } from "@/components/ui/input";
import { saveFraudSettingsAction } from "@/lib/actions/admin/fraud-review";
import { toast } from "@/lib/toast";

interface Initial {
  enabled: boolean;
  trustCfHeader: boolean;
  reviewThreshold: number;
  blockThreshold: number;
  sameIpLimit: number;
  weights: Record<string, number>;
  kycCategories: string;
  rejectedRetentionDays: number;
}

function Toggle({ name, label, hint, defaultChecked }: { name: string; label: string; hint: string; defaultChecked: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border p-3">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 size-4 accent-foreground" />
      <span className="space-y-0.5">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

export function FraudSettingsForm({
  initial,
  rules,
}: {
  initial: Initial;
  rules: Array<{ id: string; label: string; defaultWeight: number }>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await saveFraudSettingsAction(form);
      if (!result.success) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <FormSection title="Genel" description="Kurallar her sepet ödemesinde sipariş başına çalışır; ödeme anında kart bilgisi gelirse yeniden puanlanır.">
        <div className="space-y-3">
          <Toggle name="enabled" label="Risk incelemesi açık" hint="Kapalıyken yeni siparişler puanlanmaz (kimlik doğrulama şartı yine uygulanır)." defaultChecked={initial.enabled} />
          <Toggle
            name="trustCfHeader"
            label="Cloudflare ülke başlığını kullan (CF-IPCountry)"
            hint="www.kleacore.com Cloudflare arkasında. Kök alan adı proxy'siz olduğundan, çevrimdışı IP veritabanıyla çelişen “TR” başlığı yok sayılır."
            defaultChecked={initial.trustCfHeader}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="İnceleme eşiği" htmlFor="reviewThreshold" hint="Bu puan ve üstü: İnceleme bekliyor">
              <Input id="reviewThreshold" name="reviewThreshold" type="number" min={1} max={1000} defaultValue={initial.reviewThreshold} />
            </FormField>
            <FormField label="Ödeme engelleme eşiği" htmlFor="blockThreshold" hint="0 = ödeme hiç engellenmez">
              <Input id="blockThreshold" name="blockThreshold" type="number" min={0} max={1000} defaultValue={initial.blockThreshold} />
            </FormField>
            <FormField label="Aynı IP sınırı (24 saat)" htmlFor="sameIpLimit" hint="Bu kadar başka sipariş varsa kural eşleşir">
              <Input id="sameIpLimit" name="sameIpLimit" type="number" min={0} max={100} defaultValue={initial.sameIpLimit} />
            </FormField>
          </div>
        </div>
      </FormSection>

      <FormSection title="Kural puanları" description="0 kuralı kapatır. Varsayılanlar parantez içinde.">
        <div className="grid gap-4 sm:grid-cols-2">
          {rules.map((rule) => (
            <FormField key={rule.id} label={`${rule.label} (${rule.defaultWeight})`} htmlFor={`weight_${rule.id}`}>
              <Input
                id={`weight_${rule.id}`}
                name={`weight_${rule.id}`}
                type="number"
                min={0}
                max={100}
                defaultValue={initial.weights[rule.id] ?? rule.defaultWeight}
              />
            </FormField>
          ))}
        </div>
      </FormSection>

      <FormSection
        title="Kimlik doğrulama (KYC)"
        description="5651 sayılı Kanun: sunucu hizmeti verilen kişinin tespit edilebilmesi. Bu kategorilerde kurulum, müşterinin kimliği onaylanana kadar bekler."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="KYC gerektiren kategoriler" htmlFor="kycCategories" hint="Virgülle ayırın: vds, vps, server, cloud, datacenter, hosting… Boş = hiçbiri">
            <Input id="kycCategories" name="kycCategories" defaultValue={initial.kycCategories} className="font-mono" />
          </FormField>
          <FormField label="Reddedilen belgelerin silinmesi (gün)" htmlFor="rejectedRetentionDays" hint="Ret tarihinden bu kadar gün sonra dosyalar silinir">
            <Input id="rejectedRetentionDays" name="rejectedRetentionDays" type="number" min={0} max={3650} defaultValue={initial.rejectedRetentionDays} />
          </FormField>
        </div>
      </FormSection>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={pending} className={appButton({ variant: "primary" })}>
          <Save aria-hidden />
          {pending ? "Kaydediliyor…" : "Kaydet"}
        </button>
      </div>
    </form>
  );
}
