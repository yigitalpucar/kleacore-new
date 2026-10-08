"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { History, Mail, MessageSquare, RotateCcw, Save, Send, Undo2 } from "lucide-react";
import { EmptyState, FormField, SectionCard, StatusBadge, appButton } from "@/components/app";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  previewTemplateDraftAction,
  restoreTemplateVersionAction,
  revertTemplateAction,
  saveTemplateAction,
  sendTemplateTestAction,
} from "@/lib/actions/admin/notification-templates";
import { formatDateTime } from "@/lib/format/date";
import { smsLength } from "@/lib/notifications/sms-length";
import type { TemplateVariable } from "@/lib/notifications/template-variables";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { EmailPreview } from "../email-preview";

type Field = "subject" | "bodyHtml" | "bodyText";
interface Draft {
  subject: string;
  bodyHtml: string;
  bodyText: string;
}
interface Preview {
  subject: string;
  html: string;
  text: string;
  sms: string | null;
}
interface FieldError {
  field: string;
  message: string;
}

const ACTION_LABELS: Record<string, string> = {
  save: "Kaydedildi",
  revert: "Varsayılana dönüldü",
  restore: "Geri yüklendi",
};

export function TemplateEditor(props: {
  templateKey: string;
  label: string;
  audience: "customer" | "admin";
  channel: "EMAIL" | "SMS";
  hasSms: boolean;
  sensitive: string[];
  variables: TemplateVariable[];
  initial: Draft;
  defaults: Draft;
  override: { isActive: boolean; version: number; updatedAt: string } | null;
  versions: Array<{ id: string; version: number; action: string; isActive: boolean; createdAt: string; by: string }>;
  initialPreview: Preview;
}) {
  const { templateKey, channel } = props;
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(props.initial);
  const [preview, setPreview] = useState<Preview>(props.initialPreview);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [pending, startTransition] = useTransition();
  const [lastField, setLastField] = useState<Field>(channel === "SMS" ? "bodyText" : "bodyHtml");
  const subjectRef = useRef<HTMLInputElement>(null);
  const htmlRef = useRef<HTMLTextAreaElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const dirty =
    draft.subject !== props.initial.subject || draft.bodyHtml !== props.initial.bodyHtml || draft.bodyText !== props.initial.bodyText;
  const active = Boolean(props.override?.isActive);

  // Live preview: debounced server render with the template's sample data.
  useEffect(() => {
    const handle = setTimeout(async () => {
      const result = await previewTemplateDraftAction(templateKey, channel, draft);
      if (result.success) {
        setErrors([]);
        setPreview({ subject: result.subject, html: result.html, text: result.text, sms: result.sms });
      } else {
        setErrors(result.errors ?? [{ field: "", message: result.error }]);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [draft, templateKey, channel]);

  const insertVariable = (token: string) => {
    const field = lastField;
    const element = field === "subject" ? subjectRef.current : field === "bodyHtml" ? htmlRef.current : textRef.current;
    const value = draft[field];
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    setDraft((current) => ({ ...current, [field]: next }));
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const run = (task: () => Promise<{ success: boolean; error?: string; errors?: FieldError[] }>, ok: string) =>
    startTransition(async () => {
      const result = await task();
      if (!result.success) {
        if (result.errors) setErrors(result.errors);
        toast.error(result.error ?? "İşlem başarısız");
        return;
      }
      toast.success(ok);
      router.refresh();
    });

  const smsInfo = useMemo(() => (preview.sms ? smsLength(preview.sms) : null), [preview.sms]);
  const rawSmsInfo = useMemo(() => (channel === "SMS" ? smsLength(draft.bodyText) : null), [channel, draft.bodyText]);

  const fieldError = (field: Field) => errors.filter((error) => error.field === field).map((error) => error.message).join(" ");
  const bind = (field: Field) => ({
    value: draft[field],
    onFocus: () => setLastField(field),
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft((current) => ({ ...current, [field]: event.target.value })),
  });

  const ownVariables = props.variables.filter((variable) => !variable.name.includes(".") && variable.name !== "baseUrl");
  const globalVariables = props.variables.filter((variable) => variable.name.includes(".") || variable.name === "baseUrl");

  return (
    <>
      <SectionCard
        title={props.label}
        description={`${templateKey} · ${props.audience === "admin" ? "yönetime" : "müşteriye"}`}
        actions={
          active ? (
            <StatusBadge tone="info" label={`Düzenlenmiş · sürüm ${props.override?.version}`} />
          ) : (
            <StatusBadge tone="muted" label="Varsayılan (kod)" />
          )
        }
      >
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Kanal">
          <Link
            href={`/yonetim/bildirimler/sablonlar?t=${encodeURIComponent(templateKey)}`}
            role="tab"
            aria-selected={channel === "EMAIL"}
            className={appButton({ variant: channel === "EMAIL" ? "secondary" : "ghost", size: "sm" })}
          >
            <Mail aria-hidden />
            E-posta
          </Link>
          {props.hasSms ? (
            <Link
              href={`/yonetim/bildirimler/sablonlar?t=${encodeURIComponent(templateKey)}&c=SMS`}
              role="tab"
              aria-selected={channel === "SMS"}
              className={appButton({ variant: channel === "SMS" ? "secondary" : "ghost", size: "sm" })}
            >
              <MessageSquare aria-hidden />
              SMS
            </Link>
          ) : null}
        </div>
        {props.sensitive.length ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Gizli alanlar ({props.sensitive.join(", ")}) kayıtlarda şifreli tutulur, müşterinin panel kopyasında gizlenir.
          </p>
        ) : null}
      </SectionCard>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
        <SectionCard
          title="Düzenle"
          description={
            channel === "EMAIL"
              ? "Gövde, markalı şablonun (logo, alt bilgi) içine yerleşir. Değerler otomatik olarak güvenli hale getirilir; {{#ad}}…{{/ad}} değer varsa gösterir, {{^ad}}…{{/ad}} yoksa."
              : "SMS metni. Değişkenler {{ad}} biçiminde yazılır."
          }
          footer={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                className={appButton({ variant: "primary", size: "sm" })}
                onClick={() => run(() => saveTemplateAction(templateKey, channel, draft), "Şablon kaydedildi ve etkinleştirildi")}
              >
                <Save aria-hidden />
                Kaydet
              </button>
              <button
                type="button"
                disabled={pending}
                className={appButton({ variant: "outline", size: "sm" })}
                onClick={() =>
                  startTransition(async () => {
                    const result = await sendTemplateTestAction(templateKey, channel, draft);
                    if (!result.success) {
                      if ("errors" in result && result.errors) setErrors(result.errors);
                      toast.error(result.error);
                      return;
                    }
                    toast.success(`Test ${channel === "SMS" ? "SMS'i" : "e-postası"} gönderildi: ${result.to}`);
                  })
                }
              >
                <Send aria-hidden />
                {channel === "SMS" ? "Test SMS'i gönder (telefonuma)" : "Test gönder (e-postama)"}
              </button>
              <button
                type="button"
                disabled={pending}
                className={appButton({ variant: "ghost", size: "sm" })}
                onClick={() => setDraft(props.defaults)}
              >
                <RotateCcw aria-hidden />
                Metni varsayılanla doldur
              </button>
              {active ? (
                <button
                  type="button"
                  disabled={pending}
                  className={appButton({ variant: "ghost", size: "sm" })}
                  onClick={() => {
                    if (!window.confirm("Düzenleme devre dışı bırakılsın ve koddaki varsayılan şablon kullanılsın mı? Metin sürüm geçmişinde kalır.")) return;
                    run(() => revertTemplateAction(templateKey, channel), "Varsayılan şablona dönüldü");
                  }}
                >
                  <Undo2 aria-hidden />
                  Varsayılana dön
                </button>
              ) : null}
              {dirty ? <span className="self-center text-xs text-muted-foreground">Kaydedilmemiş değişiklik var</span> : null}
            </div>
          }
        >
          <div className="space-y-4">
            {!active ? (
              <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                Bu metin koddaki şablondan örnek veriyle üretildi. Evet/hayır alanlarına bağlı cümleler örnekteki haliyle gelir; gerekirse {"{{#alan}}…{{/alan}}"} bloklarıyla düzenleyin. Kaydedene kadar müşterilere koddaki şablon gider.
              </p>
            ) : null}
            {channel === "EMAIL" ? (
              <>
                <FormField label="Konu" htmlFor="tpl-subject" error={fieldError("subject") || undefined}>
                  <Input id="tpl-subject" ref={subjectRef} {...bind("subject")} className="h-11 font-mono text-[13px] md:h-9" />
                </FormField>
                <FormField label="HTML gövde" htmlFor="tpl-html" error={fieldError("bodyHtml") || undefined}>
                  <Textarea id="tpl-html" ref={htmlRef} {...bind("bodyHtml")} rows={18} spellCheck={false} className="font-mono text-xs leading-relaxed" />
                </FormField>
                <FormField
                  label="Düz metin sürümü"
                  htmlFor="tpl-text"
                  hint="Boş bırakılırsa HTML gövdeden üretilir. Alt bilgi (firma bilgileri) otomatik eklenir."
                  error={fieldError("bodyText") || undefined}
                >
                  <Textarea id="tpl-text" ref={textRef} {...bind("bodyText")} rows={8} spellCheck={false} className="font-mono text-xs leading-relaxed" />
                </FormField>
              </>
            ) : (
              <FormField label="SMS metni" htmlFor="tpl-sms" error={fieldError("bodyText") || undefined}>
                <Textarea id="tpl-sms" ref={textRef} {...bind("bodyText")} rows={5} spellCheck={false} className="font-mono text-[13px]" />
              </FormField>
            )}
            {errors.some((error) => !error.field) ? (
              <p role="alert" className="text-sm text-destructive">
                {errors.filter((error) => !error.field).map((error) => error.message).join(" ")}
              </p>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard title="Değişkenler" description="Tıklayınca imlecin olduğu alana eklenir." headingLevel={3} flush>
          <div className="max-h-[560px] space-y-3 overflow-y-auto p-3">
            {[
              { title: "Bu bildirim", items: ownVariables },
              { title: "Genel", items: globalVariables },
            ].map((group) => (
              <div key={group.title}>
                <p className="pb-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{group.title}</p>
                <ul className="space-y-1">
                  {group.items.map((variable) => {
                    const token =
                      variable.kind === "objectList"
                        ? `{{#${variable.name}}}${(variable.itemKeys ?? []).map((key) => `{{${key}}}`).join(" ")}{{/${variable.name}}}`
                        : variable.kind === "boolean"
                          ? `{{#${variable.name}}}…{{/${variable.name}}}`
                          : `{{${variable.name}}}`;
                    return (
                      <li key={variable.name}>
                        <button
                          type="button"
                          onClick={() => insertVariable(token)}
                          className="w-full rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted"
                        >
                          <span className="block break-all font-mono text-xs">{`{{${variable.name}}}`}</span>
                          <span className="block text-[11px] leading-snug text-muted-foreground">{variable.description}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      {channel === "SMS" ? (
        <SectionCard title="SMS önizleme" description="Örnek veriyle" headingLevel={3}>
          <p className="font-mono text-sm">{preview.sms ?? "—"}</p>
          {smsInfo ? (
            <dl className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <div>
                <dt className="sr-only">Örnek veriyle uzunluk</dt>
                <dd className={cn(smsInfo.segments > 1 && "text-foreground")}>
                  Örnek veriyle {smsInfo.length} / {smsInfo.limit} karakter · {smsInfo.segments} SMS ({smsInfo.encoding})
                </dd>
              </div>
              {rawSmsInfo ? (
                <div>
                  <dt className="sr-only">Şablon uzunluğu</dt>
                  <dd>Şablon metni {rawSmsInfo.length} karakter</dd>
                </div>
              ) : null}
              <div className="sm:col-span-2">
                <dt className="sr-only">Not</dt>
                <dd>
                  {smsInfo.encoding === "UCS-2"
                    ? `Türkçe karakterler (${smsInfo.unicodeChars.join(" ")}) mesajı UCS-2'ye çevirir: tek SMS 70, iki SMS 134 karakter.`
                    : "GSM-7: tek SMS 160, iki SMS 306 karakter. ı, ş, ğ, İ gibi harfler sınırı 70 / 134'e düşürür."}
                </dd>
              </div>
            </dl>
          ) : null}
        </SectionCard>
      ) : (
        <EmailPreview subject={preview.subject} html={preview.html} text={preview.text} />
      )}

      <SectionCard title="Sürüm geçmişi" headingLevel={3} flush>
        {props.versions.length === 0 ? (
          <EmptyState compact icon={History} title="Henüz kaydedilmiş sürüm yok" description="Kaydettiğiniz her sürüm burada saklanır." />
        ) : (
          <ul className="divide-y">
            {props.versions.map((version) => (
              <li key={version.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    Sürüm {version.version} · {ACTION_LABELS[version.action] ?? version.action}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(version.createdAt)} · {version.by}
                  </p>
                </div>
                {version.action !== "revert" && version.version !== props.override?.version ? (
                  <button
                    type="button"
                    disabled={pending}
                    className={appButton({ variant: "ghost", size: "sm" })}
                    onClick={() => run(() => restoreTemplateVersionAction(templateKey, channel, version.id), `Sürüm ${version.version} geri yüklendi`)}
                  >
                    <RotateCcw aria-hidden />
                    Geri yükle
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </>
  );
}
