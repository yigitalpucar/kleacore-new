"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, FileArchive, Send, ShieldAlert, StickyNote } from "lucide-react";
import { FormField, SectionCard, ToneDot, appButton } from "@/components/app";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  addDataRequestNoteAction,
  applyAnonymizationAction,
  generateDataExportAction,
  previewAnonymizationAction,
  respondDataRequestAction,
  setDataRequestStatusAction,
} from "@/lib/actions/admin/privacy-requests";
import { formatDateTime } from "@/lib/format/date";
import type { AnonymizationPlan } from "@/lib/privacy/anonymize";
import type { DataRequestTypeValue } from "@/lib/privacy/labels";
import { defaultResponseText } from "@/lib/privacy/response-templates";
import { toast } from "@/lib/toast";

interface RequestState {
  id: string;
  type: DataRequestTypeValue;
  status: string;
  open: boolean;
  hasAccount: boolean;
  exportCreatedAt: string | null;
  exportSizeBytes: number | null;
  exportReady: boolean;
  exportDownloadedAt: string | null;
  exportExpiresAt: string | null;
  anonymizedAt: string | null;
}

interface NoteRow {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
}

function kb(bytes: number | null) {
  return bytes ? `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("tr-TR")} KB` : "";
}

export function DataRequestActions({ request, notes }: { request: RequestState; notes: NoteRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<"COMPLETED" | "REJECTED">("COMPLETED");
  const [responseText, setResponseText] = useState(defaultResponseText(request.type, "COMPLETED"));
  const [plan, setPlan] = useState<AnonymizationPlan | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");

  async function run<T extends { success: boolean; error?: string }>(key: string, action: () => Promise<T>, ok?: string) {
    setBusy(key);
    const result = await action();
    setBusy(null);
    if (!result.success) {
      toast.error(result.error ?? "İşlem başarısız");
      return null;
    }
    if (ok) toast.success(ok);
    router.refresh();
    return result;
  }

  const changeOutcome = (next: "COMPLETED" | "REJECTED") => {
    setOutcome(next);
    setResponseText(defaultResponseText(request.type, next));
  };

  const needsExport = outcome === "COMPLETED" && request.type === "EXPORT" && !request.exportReady;
  const needsAnonymization = outcome === "COMPLETED" && request.type === "ERASURE" && request.hasAccount && !request.anonymizedAt;

  return (
    <div className="space-y-6">
      {request.status === "PENDING_VERIFICATION" ? (
        <SectionCard title="E-posta doğrulaması bekleniyor">
          <p className="text-sm text-muted-foreground">
            Başvuran e-posta adresini henüz onaylamadı; yasal süre onayla başlar. Bağlantı 48 saat sonra geçersiz olur.
          </p>
          <button
            type="button"
            className={appButton({ variant: "outline", className: "mt-3" })}
            disabled={busy !== null}
            onClick={() => run("cancel", () => setDataRequestStatusAction(request.id, "CANCELLED"), "Başvuru iptal edildi")}
          >
            Başvuruyu iptal et
          </button>
        </SectionCard>
      ) : null}

      {request.open ? (
        <SectionCard
          title="Durum"
          actions={
            request.status === "RECEIVED" ? (
              <button
                type="button"
                className={appButton({ variant: "outline", size: "sm" })}
                disabled={busy !== null}
                onClick={() => run("status", () => setDataRequestStatusAction(request.id, "IN_PROGRESS"), "İncelemeye alındı")}
              >
                İncelemeye al
              </button>
            ) : (
              <button
                type="button"
                className={appButton({ variant: "ghost", size: "sm" })}
                disabled={busy !== null}
                onClick={() => run("status", () => setDataRequestStatusAction(request.id, "RECEIVED"), "Alındı durumuna döndü")}
              >
                Alındı durumuna döndür
              </button>
            )
          }
        >
          <p className="text-sm text-muted-foreground">
            Başvuruyu sonuçlandırmak için aşağıdaki yanıt formunu kullanın; yanıt başvurana e-postayla gönderilir.
          </p>
        </SectionCard>
      ) : null}

      {request.type === "EXPORT" && request.open ? (
        <SectionCard title="Veri kopyası" description="Profil, adresler, siparişler, fatura üst verileri, ödemeler, hizmetler, alan adları, destek talepleri, onaylar ve giriş geçmişi (JSON + CSV, zip).">
          {!request.hasAccount ? (
            <p className="text-sm text-muted-foreground">Başvuru bir hesapla eşleşmiyor; dışa aktarılacak hesap verisi yok.</p>
          ) : (
            <div className="space-y-3 text-sm">
              {request.exportReady ? (
                <p className="flex items-center gap-2">
                  <ToneDot tone="success" />
                  Hazır: {request.exportCreatedAt ? formatDateTime(request.exportCreatedAt) : ""} · {kb(request.exportSizeBytes)}. Bağlantı yanıtla birlikte gönderilir (tek kullanımlık, 7 gün).
                </p>
              ) : (
                <p className="text-muted-foreground">Henüz hazırlanmadı.</p>
              )}
              <button
                type="button"
                className={appButton({ variant: "outline" })}
                disabled={busy !== null}
                onClick={() => run("export", () => generateDataExportAction(request.id), "Veri kopyası hazırlandı")}
              >
                <FileArchive aria-hidden />
                {busy === "export" ? "Hazırlanıyor…" : request.exportReady ? "Yeniden hazırla" : "Veri kopyasını hazırla"}
              </button>
            </div>
          )}
        </SectionCard>
      ) : null}

      {request.type === "EXPORT" && request.exportDownloadedAt ? (
        <SectionCard title="Veri kopyası">
          <p className="text-sm">İndirildi: {formatDateTime(request.exportDownloadedAt)} · dosya depolamadan silindi.</p>
        </SectionCard>
      ) : null}

      {request.type === "ERASURE" && request.hasAccount ? (
        <SectionCard
          title="Anonimleştirme"
          description="Önce önizleyin (hiçbir şey değişmez). Uygulama geri alınamaz; fatura ve muhasebe kayıtları yasal süre boyunca korunur."
        >
          {request.anonymizedAt ? (
            <p className="flex items-center gap-2 text-sm">
              <ToneDot tone="success" />
              Uygulandı: {formatDateTime(request.anonymizedAt)}
            </p>
          ) : request.open ? (
            <div className="space-y-4">
              <button
                type="button"
                className={appButton({ variant: "outline" })}
                disabled={busy !== null}
                onClick={async () => {
                  const result = await run("preview", () => previewAnonymizationAction(request.id));
                  if (result && "plan" in result) setPlan(result.plan);
                }}
              >
                <Eye aria-hidden />
                {busy === "preview" ? "Hazırlanıyor…" : "Önizle (deneme)"}
              </button>

              {plan ? (
                <div className="space-y-4 rounded-md border p-3 text-sm">
                  {plan.blockers.length > 0 ? (
                    <div className="space-y-1">
                      <p className="flex items-center gap-2 font-medium">
                        <ShieldAlert className="size-4" aria-hidden /> Uygulanamaz
                      </p>
                      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                        {plan.blockers.map((blocker) => (
                          <li key={blocker}>{blocker}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <div>
                    <p className="mb-1 font-medium">Değiştirilecek / silinecek</p>
                    <ul className="space-y-1">
                      {plan.changes.map((line) => (
                        <li key={line.label} className="flex gap-2">
                          <span className="w-10 shrink-0 text-right tabular-nums">{line.count}</span>
                          <span>
                            {line.label} <span className="text-muted-foreground">— {line.detail}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-1 font-medium">Korunacak (yasal saklama)</p>
                    <ul className="space-y-1">
                      {plan.retained.map((line) => (
                        <li key={line.label} className="flex gap-2">
                          <span className="w-10 shrink-0 text-right tabular-nums">{line.count}</span>
                          <span>
                            {line.label} <span className="text-muted-foreground">— {line.detail}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {plan.canApply ? (
                    <div className="space-y-3 border-t border-dashed pt-3">
                      <FormField label={`Onaylamak için hesabın e-postasını yazın (${plan.email})`} htmlFor="confirm-email">
                        <Input
                          id="confirm-email"
                          value={confirmEmail}
                          onChange={(event) => setConfirmEmail(event.target.value)}
                          autoComplete="off"
                          className="font-mono"
                        />
                      </FormField>
                      <button
                        type="button"
                        className={appButton({ variant: "destructive" })}
                        disabled={busy !== null || confirmEmail.trim().toLowerCase() !== plan.email.toLowerCase()}
                        onClick={async () => {
                          const result = await run(
                            "apply",
                            () => applyAnonymizationAction(request.id, confirmEmail),
                            "Anonimleştirme uygulandı"
                          );
                          if (result) setPlan(null);
                        }}
                      >
                        {busy === "apply" ? "Uygulanıyor…" : "Anonimleştirmeyi uygula"}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Uygulanmadı.</p>
          )}
        </SectionCard>
      ) : null}

      {request.open ? (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            if (!window.confirm("Yanıt başvurana e-postayla gönderilecek ve başvuru kapanacak. Devam edilsin mi?")) return;
            const formData = new FormData();
            formData.set("outcome", outcome);
            formData.set("responseText", responseText);
            await run("respond", () => respondDataRequestAction(request.id, formData), "Yanıt gönderildi");
          }}
        >
          <SectionCard
            title="Yanıt ve sonuç"
            description="Metin şablondan gelir; düzenleyip gönderin. E-postanın çerçevesi Bildirimler → Şablonlar'daki “KVKK başvurusu sonuçlandı” şablonudur."
            footer={
              <button type="submit" className={appButton()} disabled={busy !== null || needsExport || needsAnonymization}>
                <Send aria-hidden />
                {busy === "respond" ? "Gönderiliyor…" : "Yanıtı gönder ve kapat"}
              </button>
            }
          >
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4 text-sm" role="radiogroup" aria-label="Sonuç">
                {(["COMPLETED", "REJECTED"] as const).map((value) => (
                  <label key={value} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="outcome"
                      value={value}
                      checked={outcome === value}
                      onChange={() => changeOutcome(value)}
                      className="size-4 accent-foreground"
                    />
                    {value === "COMPLETED" ? "Kabul / sonuçlandı" : "Ret"}
                  </label>
                ))}
              </div>
              <FormField label="Yanıt metni" htmlFor="response-text">
                <Textarea id="response-text" rows={9} value={responseText} onChange={(event) => setResponseText(event.target.value)} />
              </FormField>
              {needsExport ? <p className="text-[13px] text-muted-foreground">Göndermeden önce veri kopyasını hazırlayın.</p> : null}
              {needsAnonymization ? (
                <p className="text-[13px] text-muted-foreground">Göndermeden önce anonimleştirmeyi önizleyip uygulayın.</p>
              ) : null}
            </div>
          </SectionCard>
        </form>
      ) : null}

      <SectionCard title="İç notlar" description="Yalnızca personel görür.">
        <div className="space-y-4">
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not yok.</p>
          ) : (
            <ul className="space-y-3">
              {notes.map((note) => (
                <li key={note.id} className="rounded-md border px-3 py-2 text-sm">
                  <p className="text-xs text-muted-foreground">
                    {note.authorName} · {formatDateTime(note.createdAt)}
                  </p>
                  <p className="mt-1 whitespace-pre-line">{note.body}</p>
                </li>
              ))}
            </ul>
          )}
          <form
            className="space-y-2"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const result = await run("note", () => addDataRequestNoteAction(request.id, new FormData(form)), "Not eklendi");
              if (result) form.reset();
            }}
          >
            <Textarea name="body" rows={3} required aria-label="Yeni not" placeholder="Not ekleyin…" />
            <button type="submit" className={appButton({ variant: "outline", size: "sm" })} disabled={busy !== null}>
              <StickyNote aria-hidden />
              Not ekle
            </button>
          </form>
        </div>
      </SectionCard>
    </div>
  );
}
