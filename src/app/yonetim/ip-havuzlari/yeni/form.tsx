"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Save } from "lucide-react";
import { FormField, FormSection, PageHeader, appButton } from "@/components/app";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createIpPoolAction } from "@/lib/actions/admin/ip-pools";
import { toast } from "@/lib/toast";

const control = "h-11 md:h-9";
const NONE = "__none__";

export function NewIpPoolForm({ instances }: { instances: Array<{ id: string; label: string }> }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    cidr: "",
    gateway: "",
    dnsServers: "1.1.1.1, 8.8.8.8",
    vlan: "",
    moduleInstanceId: NONE,
    reservedRanges: "",
    releaseCooldownMinutes: "60",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    start(async () => {
      const result = await createIpPoolAction({
        ...form,
        moduleInstanceId: form.moduleInstanceId === NONE ? null : form.moduleInstanceId,
      });
      if (!result.success) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success(`Havuz oluşturuldu: ${result.addressCount} adres.`);
      router.push(`/yonetim/ip-havuzlari/${result.id}`);
    });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-8">
      <PageHeader back={{ href: "/yonetim/ip-havuzlari", label: "IP havuzları" }} title="Yeni IP havuzu" />

      {error ? (
        <p role="alert" className="rounded-md border border-dashed px-4 py-3 text-sm">
          {error}
        </p>
      ) : null}

      <FormSection
        title="Ağ"
        description="Blok en fazla /20 (4096 adres) olabilir. Ağ, yayın ve ağ geçidi adresleri havuza eklenmez."
      >
        <div className="grid gap-5 md:grid-cols-2">
          <FormField label="Havuz adı" htmlFor="pool-name" required className="md:col-span-2">
            <Input id="pool-name" className={control} value={form.name} onChange={set("name")} placeholder="DCNET public /26" />
          </FormField>
          <FormField label="CIDR" htmlFor="pool-cidr" required hint="ör. 188.132.235.64/26">
            <Input id="pool-cidr" className={`${control} font-mono`} value={form.cidr} onChange={set("cidr")} />
          </FormField>
          <FormField label="Ağ geçidi" htmlFor="pool-gateway" required>
            <Input id="pool-gateway" className={`${control} font-mono`} value={form.gateway} onChange={set("gateway")} />
          </FormField>
          <FormField label="DNS sunucuları" htmlFor="pool-dns" hint="Virgülle ayırın.">
            <Input id="pool-dns" className={`${control} font-mono`} value={form.dnsServers} onChange={set("dnsServers")} />
          </FormField>
          <FormField label="VLAN" htmlFor="pool-vlan" hint="Opsiyonel (1–4094).">
            <Input id="pool-vlan" className={control} inputMode="numeric" value={form.vlan} onChange={set("vlan")} />
          </FormField>
          <FormField
            label="Ayrılmış adresler"
            htmlFor="pool-reserved"
            hint="Otomatik atanmayacak adresler: aralık veya tek adres, virgül/satırla ayırın (ör. 188.132.235.65-188.132.235.70)."
            className="md:col-span-2"
          >
            <Textarea id="pool-reserved" rows={2} className="font-mono" value={form.reservedRanges} onChange={set("reservedRanges")} />
          </FormField>
        </div>
      </FormSection>

      <FormSection
        title="Kullanım"
        description="Havuzu bir sunucu modülü örneğine (Proxmox node) bağlayın; o örnekteki VDS kurulumları buradan IP alır."
        footer={
          <button type="submit" disabled={pending} className={appButton()}>
            {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Save aria-hidden />}
            Havuzu oluştur
          </button>
        }
      >
        <div className="grid gap-5 md:grid-cols-2">
          <FormField label="Sunucu modülü örneği" htmlFor="pool-instance">
            <Select value={form.moduleInstanceId} onValueChange={(value) => setForm((prev) => ({ ...prev, moduleInstanceId: value }))}>
              <SelectTrigger id="pool-instance" className={control}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Bağlı değil</SelectItem>
                {instances.map((instance) => (
                  <SelectItem key={instance.id} value={instance.id}>
                    {instance.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            label="Serbest bırakma beklemesi (dk)"
            htmlFor="pool-cooldown"
            hint="Fesihten sonra adres bu süre boyunca yeniden atanmaz."
          >
            <Input id="pool-cooldown" className={control} inputMode="numeric" value={form.releaseCooldownMinutes} onChange={set("releaseCooldownMinutes")} />
          </FormField>
          <FormField label="Not" htmlFor="pool-notes" className="md:col-span-2">
            <Textarea id="pool-notes" rows={2} value={form.notes} onChange={set("notes")} />
          </FormField>
        </div>
      </FormSection>
    </form>
  );
}
