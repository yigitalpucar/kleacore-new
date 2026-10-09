"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileLock2, Send } from "lucide-react";
import { EmptyState, FormField, FormSection, PageHeader, SectionCard, StatusBadge, appButton } from "@/components/app";
import { DataRequestTypePicker } from "@/components/privacy/data-request-type-picker";
import { Textarea } from "@/components/ui/textarea";
import { submitCustomerDataRequestAction } from "@/lib/actions/customer/privacy";
import { formatDate } from "@/lib/format/date";
import {
  DATA_REQUEST_STATUS_TONES,
  dataRequestStatusLabel,
  dataRequestTypeLabel,
  type DataRequestStatusValue,
  type DataRequestTypeValue,
} from "@/lib/privacy/labels";
import { toast } from "@/lib/toast";

interface RequestRow {
  id: string;
  requestNumber: string;
  type: string;
  status: string;
  createdAt: string;
  dueAt: string | null;
  completedAt: string | null;
  responseText: string | null;
}

export function KvkkContent({ requests, initialType }: { requests: RequestRow[]; initialType: DataRequestTypeValue | "" }) {
  const router = useRouter();
  const [type, setType] = useState<DataRequestTypeValue | "">(initialType);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const form = event.currentTarget;
    const result = await submitCustomerDataRequestAction(new FormData(form));
    setPending(false);
    if (!result.success) {
      toast.error(result.error ?? "Başvuru gönderilemedi");
      return;
    }
    toast.success(`Başvurunuz alındı (${result.requestNumber}).`);
    form.reset();
    setType("");
    router.refresh();
  }

  return (
    <>
      <PageHeader
        title="Kişisel verilerim"
        description="6698 sayılı KVKK'nın 11. maddesi kapsamındaki haklarınızı buradan kullanabilirsiniz. Başvurularınızı en geç 30 gün içinde ücretsiz sonuçlandırırız."
        actions={
          <Link href="/yasal/kvkk" className={appButton({ variant: "outline" })}>
            Aydınlatma metni
          </Link>
        }
      />

      <form onSubmit={handleSubmit}>
        <FormSection
          title="Yeni başvuru"
          description="Hesabınızla giriş yaptığınız için ayrıca kimlik doğrulaması istenmez; başvurunuz hemen kayda alınır."
          footer={
            <button type="submit" className={appButton()} disabled={pending || !type}>
              <Send aria-hidden />
              {pending ? "Gönderiliyor…" : "Başvuruyu gönder"}
            </button>
          }
        >
          <DataRequestTypePicker value={type} onChange={setType} disabled={pending} />
          {type === "ERASURE" ? (
            <p className="rounded-md border border-dashed px-3 py-2.5 text-[13px] text-muted-foreground">
              Silme talebinde hesabınız kapatılır. Aktif hizmet, ödenmemiş fatura, aktif alan adı veya bakiye varsa önce bunların
              kapatılması gerekir. Faturalar ve ödeme kayıtları Vergi Usul Kanunu gereği 10 yıl saklanır.
            </p>
          ) : null}
          <FormField label="Açıklama" htmlFor="kvkk-details" hint="Talebinizi kısaca açıklayın (en az 10 karakter).">
            <Textarea id="kvkk-details" name="details" rows={4} required minLength={10} maxLength={5000} disabled={pending} />
          </FormField>
        </FormSection>
      </form>

      <SectionCard title="Başvurularım" flush>
        {requests.length === 0 ? (
          <div className="p-4 md:p-5">
            <EmptyState compact icon={FileLock2} title="Henüz başvurunuz yok" description="Yaptığınız KVKK başvuruları burada listelenir." />
          </div>
        ) : (
          <ul className="divide-y divide-dashed">
            {requests.map((request) => (
              <li key={request.id} className="space-y-2 px-4 py-4 md:px-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    <span className="font-mono">{request.requestNumber}</span>
                    <span className="text-muted-foreground"> · {dataRequestTypeLabel(request.type)}</span>
                  </p>
                  <StatusBadge
                    tone={DATA_REQUEST_STATUS_TONES[request.status as DataRequestStatusValue] ?? "muted"}
                    label={dataRequestStatusLabel(request.status)}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Başvuru {formatDate(request.createdAt)}
                  {request.completedAt
                    ? ` · Sonuç ${formatDate(request.completedAt)}`
                    : request.dueAt
                      ? ` · Yanıt için son tarih ${formatDate(request.dueAt)}`
                      : null}
                </p>
                {request.responseText ? (
                  <p className="whitespace-pre-line rounded-md border bg-muted/30 px-3 py-2 text-[13px]">{request.responseText}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}
