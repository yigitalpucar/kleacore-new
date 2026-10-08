"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";
import { FormField, SectionCard, appButton } from "@/components/app";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { activateManualProvisioningAction } from "@/lib/actions/admin/manual-provisioning";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type Delivery = "included" | "separately";

const DELIVERY_OPTIONS: Array<{ value: Delivery; label: string; hint: string }> = [
  { value: "included", label: "İlk şifreyi e-postaya ekle", hint: "Şifre müşteriye giden e-postada yer alır; sistemde şifreli saklanır, kayıtlarda gösterilmez." },
  { value: "separately", label: "Şifre müşteriye ayrıca iletildi", hint: "E-postada şifre yer almaz (telefon, destek talebi vb.)." },
];

export function ActivationForm({ taskId, isServer, defaultUsername }: { taskId: string; isServer: boolean; defaultUsername: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [delivery, setDelivery] = useState<Delivery>("included");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "");
    setError(null);

    startTransition(async () => {
      const result = await activateManualProvisioningAction(taskId, {
        ipAddress: value("ipAddress"),
        hostname: value("hostname"),
        username: value("username"),
        password: delivery === "included" ? value("password") : undefined,
        passwordDelivery: delivery,
        panelUrl: value("panelUrl"),
        notes: value("notes"),
      });
      if (!result.success) {
        setError({ message: result.error, field: "field" in result ? result.field : undefined });
        toast.error(result.error);
        return;
      }
      toast.success("Hizmet aktifleştirildi, müşteriye bilgilendirme e-postası kuyruğa alındı");
      router.refresh();
    });
  };

  const fieldError = (field: string) => (error?.field === field ? error.message : undefined);

  return (
    <form onSubmit={onSubmit} noValidate>
      <SectionCard
        title="Teslim bilgileri"
        description="Kurulumu tamamladıktan sonra bilgileri girin. “Aktifleştir” hizmeti aktif yapar, faturalama dönemini bugünden başlatır ve müşteriye “hizmet aktif” e-postası gönderir."
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground" role={error ? "alert" : undefined}>
              {error && !error.field ? error.message : "Bu işlem geri alınamaz; e-posta bir kez gönderilir."}
            </p>
            <button type="submit" disabled={pending} className={appButton({ variant: "primary" })}>
              <CheckCircle2 aria-hidden />
              {pending ? "Aktifleştiriliyor…" : "Aktifleştir"}
            </button>
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="IP adresi" htmlFor="ipAddress" error={fieldError("ipAddress")}>
            <Input id="ipAddress" name="ipAddress" inputMode="decimal" autoComplete="off" placeholder="203.0.113.10" className="font-mono" />
          </FormField>
          <FormField label="Sunucu adı (hostname)" htmlFor="hostname" error={fieldError("hostname")}>
            <Input id="hostname" name="hostname" autoComplete="off" placeholder="vds123.kleacore.com" className="font-mono" />
          </FormField>
          <FormField label="Kullanıcı adı" htmlFor="username" error={fieldError("username")}>
            <Input id="username" name="username" autoComplete="off" defaultValue={defaultUsername} className="font-mono" />
          </FormField>
          <FormField label="Panel adresi" htmlFor="panelUrl" hint="İsteğe bağlı (VNC / kontrol paneli)" error={fieldError("panelUrl")}>
            <Input id="panelUrl" name="panelUrl" type="url" autoComplete="off" placeholder="https://" className="font-mono" />
          </FormField>
        </div>

        <fieldset className="mt-5 space-y-3">
          <legend className="mb-2 text-sm font-medium">İlk şifre</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {DELIVERY_OPTIONS.map((option) => {
              const checked = delivery === option.value;
              return (
                <label
                  key={option.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-md border p-3.5 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                    checked ? "border-foreground bg-muted/50" : "hover:bg-muted/40"
                  )}
                >
                  <input
                    type="radio"
                    name="passwordDelivery"
                    value={option.value}
                    checked={checked}
                    onChange={() => setDelivery(option.value)}
                    className="sr-only"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{option.label}</span>
                    <span className="block text-xs text-muted-foreground">{option.hint}</span>
                  </span>
                  <span aria-hidden className={cn("ml-auto mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border", checked && "border-foreground")}>
                    {checked ? <span className="size-2 rounded-full bg-foreground" /> : null}
                  </span>
                </label>
              );
            })}
          </div>
          {delivery === "included" ? (
            <FormField label="İlk şifre" htmlFor="password" required error={fieldError("password")}>
              <div className="flex gap-2">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  spellCheck={false}
                  className="font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className={appButton({ variant: "outline", size: "icon" })}
                  aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                >
                  {showPassword ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                </button>
              </div>
            </FormField>
          ) : null}
        </fieldset>

        <FormField label="Notlar" htmlFor="notes" hint="Müşteriye giden e-postada gösterilir (ör. kurulu işletim sistemi)." className="mt-5">
          <Textarea id="notes" name="notes" rows={3} />
        </FormField>
      </SectionCard>
    </form>
  );
}
