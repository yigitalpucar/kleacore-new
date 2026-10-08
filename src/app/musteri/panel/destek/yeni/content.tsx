"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, Loader2, Send } from "lucide-react";
import { FormField, PageHeader, SectionCard, appButton } from "@/components/app";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { AttachmentPicker, postTicketForm } from "@/components/support/attachments";

interface ServiceItem {
  id: string;
  label: string;
  domain: string | null;
  productName: string;
}

interface YeniDestekContentProps {
  services: ServiceItem[];
}

const departments = [
  { value: "GENERAL", label: "Genel", description: "Genel sorular" },
  { value: "TECHNICAL", label: "Teknik destek", description: "Sunucu, hosting, domain sorunları" },
  { value: "SALES", label: "Satış", description: "Fiyatlandırma, yeni hizmetler" },
  { value: "BILLING", label: "Muhasebe", description: "Fatura, ödeme sorunları" },
];

const priorities = [
  { value: "LOW", label: "Düşük", description: "Acil değil, zaman olunca bakılabilir" },
  { value: "MEDIUM", label: "Normal", description: "Standart öncelik" },
  { value: "HIGH", label: "Yüksek", description: "Önemli, hızlı yanıt gerekiyor" },
];

export function YeniDestekContent({ services }: YeniDestekContentProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [department, setDepartment] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [service, setService] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.set("subject", subject);
    formData.set("department", department);
    formData.set("priority", priority);
    formData.set("message", message);
    if (service) {
      formData.set("relatedServiceId", service);
    }
    for (const file of files) formData.append("files", file);

    const result = await postTicketForm<{ id: string; ticketNumber: string }>("/api/support/tickets", formData);

    if (result.success) {
      toast.success("Destek talebiniz oluşturuldu.");
      router.push("/musteri/panel/destek");
    } else {
      const errorMessage = result.error ?? "Bir hata oluştu";
      setError(errorMessage);
      toast.error(errorMessage);
      setIsSubmitting(false);
    }
  };

  const isFormValid = department && subject.trim() && message.trim();

  return (
    <>
      <PageHeader
        back={{ href: "/musteri/panel/destek", label: "Destek talepleri" }}
        title="Yeni destek talebi"
        description="Sorununuzu ayrıntılı açıklayın; ekibimiz talebinizi en kısa sürede yanıtlasın."
      />

      {error ? (
        <div role="alert" className="rounded-lg border border-red-500/40 bg-card p-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit}>
        <div className="grid items-start gap-6 lg:grid-cols-3">
          <SectionCard title="Talep ayrıntıları" className="lg:col-span-2" bodyClassName="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Departman" htmlFor="department" required>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger id="department" className="h-11 md:h-10">
                    <SelectValue placeholder="Departman seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.value} value={dept.value}>
                        <div>
                          <p className="font-medium">{dept.label}</p>
                          <p className="text-xs text-muted-foreground">{dept.description}</p>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="İlgili hizmet" htmlFor="service" hint="İsteğe bağlı">
                <Select value={service} onValueChange={setService}>
                  <SelectTrigger id="service" className="h-11 md:h-10">
                    <SelectValue placeholder={services.length ? "Hizmet seçin" : "Hizmetiniz yok"} />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((svc) => (
                      <SelectItem key={svc.id} value={svc.id}>
                        {svc.label || svc.productName}
                        {svc.domain ? ` · ${svc.domain}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            <FormField label="Konu" htmlFor="subject" required>
              <Input
                id="subject"
                placeholder="Sorununuzu kısaca özetleyin"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="h-11 md:h-10"
              />
            </FormField>

            <FormField
              label="Mesaj"
              htmlFor="message"
              required
              hint="Sorun ne zaman başladı, neler denediniz, bir hata mesajı görüyor musunuz? Alan adı veya IP bilgisini eklemeyi unutmayın."
            >
              <Textarea
                id="message"
                placeholder="Sorununuzu ayrıntılı olarak açıklayın…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={8}
              />
            </FormField>

            <div className="space-y-1.5">
              <p id="attachments-label" className="text-sm font-medium leading-none">
                Dosya ekleri
              </p>
              <AttachmentPicker files={files} onChange={setFiles} disabled={isSubmitting} />
            </div>
          </SectionCard>

          <div className="space-y-6 lg:sticky lg:top-20">
            <SectionCard title="Öncelik">
              <div role="radiogroup" aria-label="Öncelik" className="space-y-2">
                {priorities.map((p) => {
                  const selected = priority === p.value;
                  return (
                    <label
                      key={p.value}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors focus-within:ring-2 focus-within:ring-ring",
                        selected ? "border-foreground bg-muted/50" : "hover:bg-muted/40"
                      )}
                    >
                      <input
                        type="radio"
                        name="priority"
                        value={p.value}
                        checked={selected}
                        onChange={(e) => setPriority(e.target.value)}
                        className="sr-only"
                      />
                      <span
                        aria-hidden
                        className={cn(
                          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                          selected && "border-foreground bg-foreground text-background"
                        )}
                      >
                        {selected ? <Check className="size-3" /> : null}
                      </span>
                      <span>
                        <span className="block text-sm font-medium">{p.label}</span>
                        <span className="block text-xs text-muted-foreground">{p.description}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </SectionCard>

            <div className="rounded-lg border border-dashed p-4 text-sm">
              <p className="font-medium">Hızlı ipuçları</p>
              <ul className="mt-2 space-y-1.5 text-muted-foreground">
                <li>Sorunu adım adım açıklayın.</li>
                <li>Gördüğünüz hata mesajını aynen yazın.</li>
                <li>İlgili alan adı veya IP adresini belirtin.</li>
              </ul>
            </div>

            <button
              type="submit"
              className={appButton({ className: "w-full md:h-10" })}
              disabled={!isFormValid || isSubmitting}
            >
              {isSubmitting ? <Loader2 aria-hidden className="animate-spin" /> : <Send aria-hidden />}
              {isSubmitting ? "Gönderiliyor…" : "Talebi gönder"}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}
