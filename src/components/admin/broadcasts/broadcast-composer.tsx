"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bold, Heading2, Italic, Link2, List, Loader2, Pilcrow, Send, Users } from "lucide-react";
import { EmptyState, FormField, FormSection, SectionCard, appButton } from "@/components/app";
import { fromLocalInput } from "@/components/admin-b/durum/shared";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createBroadcastAction,
  previewBroadcastAudienceAction,
  previewBroadcastContentAction,
  sendBroadcastTestAction,
} from "@/lib/actions/admin/broadcasts";
import type { AudienceOptions, AudiencePreview } from "@/lib/broadcasts/audience";
import { smsLength } from "@/lib/notifications/sms-length";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type Kind = "SERVICE" | "MARKETING";
type Channel = "EMAIL" | "SMS";
type UserStatus = "ACTIVE" | "SUSPENDED" | "CLOSED";
type ServiceStatus = "PENDING" | "ACTIVE" | "SUSPENDED" | "CANCELLED" | "EXPIRED";
type ServerTarget = { instanceId: string; node?: string };

const USER_STATUS_OPTIONS: { value: UserStatus; label: string }[] = [
  { value: "ACTIVE", label: "Aktif" },
  { value: "SUSPENDED", label: "Askıda" },
  { value: "CLOSED", label: "Kapalı" },
];

const SERVICE_STATUS_OPTIONS: { value: ServiceStatus; label: string }[] = [
  { value: "ACTIVE", label: "Aktif" },
  { value: "SUSPENDED", label: "Askıda" },
  { value: "PENDING", label: "Kurulum sürüyor" },
  { value: "CANCELLED", label: "İptal edildi" },
  { value: "EXPIRED", label: "Süresi doldu" },
];

const MODULE_LABEL: Record<string, string> = { "cpanel-whm": "WHM", proxmox: "Proxmox", virtualizor: "Virtualizor" };

const STARTER_HTML = `<p>Merhaba {{customer.name}},</p>
<p></p>
<p>Anlayışınız için teşekkür ederiz.<br />{{brand.siteName}} Ekibi</p>`;

function toggle<T>(list: T[], value: T) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function sameTarget(a: ServerTarget, b: ServerTarget) {
  return a.instanceId === b.instanceId && (a.node ?? "") === (b.node ?? "");
}

function CheckRow({ id, checked, onChange, label, hint }: { id: string; checked: boolean; onChange: () => void; label: string; hint?: string }) {
  return (
    <label htmlFor={id} className="flex min-h-10 cursor-pointer items-start gap-2.5 rounded-md px-2 py-2 hover:bg-muted">
      <Checkbox id={id} checked={checked} onCheckedChange={onChange} className="mt-0.5" />
      <span className="min-w-0 text-sm leading-snug">
        {label}
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  );
}

function ChoiceCard({ checked, onSelect, title, description, name, value }: { checked: boolean; onSelect: () => void; title: string; description: string; name: string; value: string }) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/60",
        checked && "border-foreground bg-muted/60"
      )}
    >
      <input type="radio" name={name} value={value} checked={checked} onChange={onSelect} className="mt-1 accent-foreground" />
      <span className="space-y-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-[13px] text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

export function BroadcastComposer({
  options,
  variables,
  components,
  canPublishStatus,
  rate,
  me,
}: {
  options: AudienceOptions;
  variables: { name: string; description: string }[];
  components: { id: string; serviceName: string }[];
  canPublishStatus: boolean;
  rate: number;
  me: { email: string; phone: string | null };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [testing, startTest] = useTransition();

  // Type + audience
  const [kind, setKind] = useState<Kind>("SERVICE");
  const [userStatuses, setUserStatuses] = useState<UserStatus[]>(["ACTIVE"]);
  const [customerType, setCustomerType] = useState<"" | "INDIVIDUAL" | "CORPORATE">("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [productIds, setProductIds] = useState<string[]>([]);
  const [servers, setServers] = useState<ServerTarget[]>([]);
  const [serviceStatuses, setServiceStatuses] = useState<ServiceStatus[]>(["ACTIVE", "SUSPENDED"]);
  const [tldText, setTldText] = useState("");
  const [productQuery, setProductQuery] = useState("");

  // Content
  const [channels, setChannels] = useState<Channel[]>(["EMAIL"]);
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState(STARTER_HTML);
  const [bodyText, setBodyText] = useState("");
  const [smsText, setSmsText] = useState("");
  const htmlRef = useRef<HTMLTextAreaElement>(null);
  const smsRef = useRef<HTMLTextAreaElement>(null);
  const [lastFocus, setLastFocus] = useState<"html" | "sms">("html");

  // Status page + timing
  const [publishIncident, setPublishIncident] = useState(false);
  const [componentId, setComponentId] = useState(components[0]?.id ?? "");
  const [windowStart, setWindowStart] = useState("");
  const [windowEnd, setWindowEnd] = useState("");
  const [timing, setTiming] = useState<"now" | "schedule">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [error, setError] = useState<string | null>(null);

  const audience = useMemo(
    () => ({
      userStatuses,
      customerTypes: customerType ? [customerType] : [],
      categoryIds,
      productIds,
      servers,
      serviceStatuses,
      tlds: tldText
        .split(/[\s,;]+/)
        .map((value) => value.trim().replace(/^\.+/, "").toLowerCase())
        .filter(Boolean),
    }),
    [userStatuses, customerType, categoryIds, productIds, servers, serviceStatuses, tldText]
  );
  const hasServiceFilter = categoryIds.length > 0 || productIds.length > 0 || servers.length > 0;
  const input = { kind, subject, bodyHtml, bodyText, smsText, channels, audience };

  // Audience preview (debounced)
  const [preview, setPreview] = useState<AudiencePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [counting, setCounting] = useState(false);
  const audienceKey = JSON.stringify({ kind, audience });
  useEffect(() => {
    let cancelled = false;
    setCounting(true);
    const timer = setTimeout(async () => {
      const result = await previewBroadcastAudienceAction(kind, audience);
      if (cancelled) return;
      setCounting(false);
      if (result.success) {
        setPreview(result.data);
        setPreviewError(null);
      } else {
        setPreviewError(result.error);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- audienceKey captures kind + audience
  }, [audienceKey]);

  // Content preview (debounced)
  const [rendered, setRendered] = useState<{ subject: string; html: string; text: string; sms: string | null } | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const contentKey = JSON.stringify({ kind, subject, bodyHtml, bodyText, smsText });
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await previewBroadcastContentAction({ ...input, channels: channels.length ? channels : ["EMAIL"] });
      if (cancelled) return;
      if (result.success) {
        setRendered(result.data);
        setRenderError(null);
      } else {
        setRenderError(result.error);
      }
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- contentKey captures the content fields
  }, [contentKey]);

  const smsInfo = smsText.trim() ? smsLength(smsText) : null;

  const insertAtCursor = (target: "html" | "sms", before: string, after = "") => {
    const ref = target === "html" ? htmlRef.current : smsRef.current;
    const value = target === "html" ? bodyHtml : smsText;
    const set = target === "html" ? setBodyHtml : setSmsText;
    const from = ref?.selectionStart ?? value.length;
    const to = ref?.selectionEnd ?? value.length;
    const selected = value.slice(from, to);
    const next = `${value.slice(0, from)}${before}${selected}${after}${value.slice(to)}`;
    set(next);
    requestAnimationFrame(() => {
      if (!ref) return;
      ref.focus();
      const caret = from + before.length + selected.length;
      ref.setSelectionRange(caret, caret);
    });
  };

  const wrap = (tag: string) => insertAtCursor("html", `<${tag}>`, `</${tag}>`);
  const addLink = () => {
    const url = window.prompt("Bağlantı adresi (https://…)");
    if (!url) return;
    if (!/^(https?:|mailto:)/i.test(url.trim())) {
      toast.error("Bağlantı https://, http:// veya mailto: ile başlamalı");
      return;
    }
    insertAtCursor("html", `<a href="${url.trim().replace(/"/g, "&quot;")}">`, "</a>");
  };

  const buildStart = (mode: "draft" | "now" | "schedule") => {
    const incident =
      publishIncident && mode !== "draft"
        ? { componentId, start: fromLocalInput(windowStart) ?? "", end: fromLocalInput(windowEnd) ?? "" }
        : undefined;
    if (mode === "schedule") return { mode, scheduledAt: fromLocalInput(scheduledAt) ?? "", ...(incident ? { incident } : {}) } as const;
    if (mode === "now") return { mode, ...(incident ? { incident } : {}) } as const;
    return { mode } as const;
  };

  const submit = (mode: "draft" | "now" | "schedule") => {
    setError(null);
    if (mode !== "draft") {
      const count = preview?.total ?? 0;
      if (count === 0) {
        setError("Seçtiğiniz hedef kitlede alıcı yok.");
        return;
      }
      const when = mode === "schedule" ? "zamanlanmış saatte" : "şimdi";
      if (!window.confirm(`Duyuru ${count.toLocaleString("tr-TR")} müşteriye ${when} gönderilecek. Devam edilsin mi?`)) return;
    }
    start(async () => {
      const result = await createBroadcastAction(input, buildStart(mode));
      if (!result.success) {
        setError(result.error);
        return;
      }
      toast.success(mode === "draft" ? "Taslak kaydedildi" : mode === "schedule" ? "Duyuru zamanlandı" : "Duyuru gönderilmeye başlandı");
      router.push(`/yonetim/duyurular/${result.data.id}`);
    });
  };

  const sendTest = () => {
    setError(null);
    startTest(async () => {
      const result = await sendBroadcastTestAction(input);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(result.data.channels.length ? `Test gönderildi — ${result.data.channels.join(", ")}` : "Test için gönderilecek kanal yok");
    });
  };

  const filteredProducts = options.products.filter((product) => {
    const q = productQuery.trim().toLocaleLowerCase("tr-TR");
    return !q || `${product.name} ${product.category}`.toLocaleLowerCase("tr-TR").includes(q);
  });

  return (
    <div className="space-y-8">
      <FormSection title="Duyuru türü" description="Tür, kimlerin duyuruyu alacağını belirler.">
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            name="kind"
            value="SERVICE"
            checked={kind === "SERVICE"}
            onSelect={() => setKind("SERVICE")}
            title="Hizmet / bakım duyurusu"
            description="Planlı bakım, kesinti, hizmet değişikliği. Bilgilendirme amaçlıdır; etkilenen herkese gider."
          />
          <ChoiceCard
            name="kind"
            value="MARKETING"
            checked={kind === "MARKETING"}
            onSelect={() => setKind("MARKETING")}
            title="Kampanya"
            description="İndirim, yeni ürün, tanıtım. Yalnızca ticari ileti onayı verenlere gider; e-postada abonelikten çıkma bağlantısı olur."
          />
        </div>
        {kind === "MARKETING" ? (
          <p role="note" className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
            Kampanya içerikli ileti göndermeden önce İYS kaydı ve alıcı onaylarının İYS&apos;de olması gerekir.
          </p>
        ) : null}
      </FormSection>

      <FormSection
        title="Hedef kitle"
        description="Gruplar birlikte uygulanır (VE); bir grubun içindeki seçimlerden herhangi biri yeterlidir (VEYA). Ürün ve sunucu seçimleri aynı hizmette aranır."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <fieldset className="space-y-1">
            <legend className="mb-1 text-sm font-medium">Müşteri hesabı</legend>
            {USER_STATUS_OPTIONS.map((option) => (
              <CheckRow
                key={option.value}
                id={`us-${option.value}`}
                checked={userStatuses.includes(option.value)}
                onChange={() => setUserStatuses(toggle(userStatuses, option.value))}
                label={option.label}
              />
            ))}
          </fieldset>
          <fieldset className="space-y-1">
            <legend className="mb-1 text-sm font-medium">Müşteri tipi</legend>
            {[
              { value: "" as const, label: "Tümü" },
              { value: "INDIVIDUAL" as const, label: "Bireysel" },
              { value: "CORPORATE" as const, label: "Kurumsal" },
            ].map((option) => (
              <label key={option.value || "all"} className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm hover:bg-muted">
                <input type="radio" name="customerType" checked={customerType === option.value} onChange={() => setCustomerType(option.value)} className="accent-foreground" />
                {option.label}
              </label>
            ))}
          </fieldset>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <fieldset className="space-y-1">
            <legend className="mb-1 text-sm font-medium">Sunucu / modül örneği</legend>
            <p className="px-2 pb-1 text-xs text-muted-foreground">Bakım duyuruları için: o sunucudaki (veya Proxmox düğümündeki) hizmetlerin sahipleri.</p>
            <div className="max-h-64 overflow-y-auto rounded-md border p-1">
              {options.instances.length === 0 ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">Kayıtlı sunucu modülü yok.</p>
              ) : (
                options.instances.map((instance) => (
                  <div key={instance.id}>
                    <CheckRow
                      id={`srv-${instance.id}`}
                      checked={servers.some((target) => sameTarget(target, { instanceId: instance.id }))}
                      onChange={() =>
                        setServers((list) =>
                          list.some((target) => sameTarget(target, { instanceId: instance.id }))
                            ? list.filter((target) => !sameTarget(target, { instanceId: instance.id }))
                            : [...list, { instanceId: instance.id }]
                        )
                      }
                      label={instance.label}
                      hint={`${MODULE_LABEL[instance.moduleId] ?? instance.moduleId}${instance.isActive ? "" : " · pasif"}`}
                    />
                    {instance.nodes.map((node) => (
                      <div key={node} className="pl-6">
                        <CheckRow
                          id={`srv-${instance.id}-${node}`}
                          checked={servers.some((target) => sameTarget(target, { instanceId: instance.id, node }))}
                          onChange={() =>
                            setServers((list) =>
                              list.some((target) => sameTarget(target, { instanceId: instance.id, node }))
                                ? list.filter((target) => !sameTarget(target, { instanceId: instance.id, node }))
                                : [...list, { instanceId: instance.id, node }]
                            )
                          }
                          label={`Düğüm: ${node}`}
                        />
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </fieldset>

          <fieldset className="space-y-1">
            <legend className="mb-1 text-sm font-medium">Ürün kategorisi / ürün</legend>
            <div className="max-h-64 overflow-y-auto rounded-md border p-1">
              {options.categories.map((category) => (
                <CheckRow
                  key={category.id}
                  id={`cat-${category.id}`}
                  checked={categoryIds.includes(category.id)}
                  onChange={() => setCategoryIds(toggle(categoryIds, category.id))}
                  label={category.name}
                  hint="Kategorideki tüm ürünler"
                />
              ))}
              <div className="border-t px-1 pt-2">
                <Input
                  aria-label="Ürün ara"
                  placeholder="Ürün ara…"
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  className="h-9"
                />
              </div>
              {filteredProducts.map((product) => (
                <CheckRow
                  key={product.id}
                  id={`prd-${product.id}`}
                  checked={productIds.includes(product.id)}
                  onChange={() => setProductIds(toggle(productIds, product.id))}
                  label={product.name}
                  hint={product.category}
                />
              ))}
            </div>
          </fieldset>
        </div>

        {hasServiceFilter ? (
          <fieldset>
            <legend className="mb-1 text-sm font-medium">Hizmet durumu</legend>
            <div className="flex flex-wrap gap-x-2">
              {SERVICE_STATUS_OPTIONS.map((option) => (
                <CheckRow
                  key={option.value}
                  id={`ss-${option.value}`}
                  checked={serviceStatuses.includes(option.value)}
                  onChange={() => setServiceStatuses(toggle(serviceStatuses, option.value))}
                  label={option.label}
                />
              ))}
            </div>
          </fieldset>
        ) : null}

        <FormField label="Alan adı uzantısı" htmlFor="bc-tld" hint="Virgülle ayırın, örn. com.tr, net. Bu uzantıda aktif alan adı olan müşteriler.">
          <Input id="bc-tld" value={tldText} onChange={(e) => setTldText(e.target.value)} placeholder="com.tr, com" className="h-11 md:h-10" />
        </FormField>

        <AudienceSummary preview={preview} error={previewError} counting={counting} kind={kind} channels={channels} />
      </FormSection>

      <FormSection title="İçerik" description="Değişkenler gönderimde her müşteri için güvenli biçimde doldurulur; HTML içindeki betikler ve tehlikeli bağlantılar temizlenir.">
        <fieldset>
          <legend className="mb-1 text-sm font-medium">Kanallar</legend>
          <div className="flex flex-wrap gap-x-2">
            <CheckRow id="ch-email" checked={channels.includes("EMAIL")} onChange={() => setChannels(toggle(channels, "EMAIL"))} label="E-posta" />
            <CheckRow
              id="ch-sms"
              checked={channels.includes("SMS")}
              onChange={() => setChannels(toggle(channels, "SMS"))}
              label="SMS"
              hint="Telefonu kayıtlı müşterilere; SMS bildirimleri açık olmalı"
            />
          </div>
        </fieldset>

        <FormField label="Konu" htmlFor="bc-subject" required>
          <Input id="bc-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} className="h-11 md:h-10" placeholder="Planlı bakım: WHM-1 sunucusu (15 Ekim 02:00–04:00)" />
        </FormField>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="bc-html" className="text-sm font-medium">
              E-posta metni
            </label>
            <div className="flex flex-wrap gap-1" role="toolbar" aria-label="Biçimlendirme">
              <button type="button" className={appButton({ variant: "ghost", size: "icon-sm" })} aria-label="Kalın" onClick={() => wrap("strong")}>
                <Bold aria-hidden />
              </button>
              <button type="button" className={appButton({ variant: "ghost", size: "icon-sm" })} aria-label="İtalik" onClick={() => wrap("em")}>
                <Italic aria-hidden />
              </button>
              <button type="button" className={appButton({ variant: "ghost", size: "icon-sm" })} aria-label="Alt başlık" onClick={() => wrap("h2")}>
                <Heading2 aria-hidden />
              </button>
              <button type="button" className={appButton({ variant: "ghost", size: "icon-sm" })} aria-label="Paragraf" onClick={() => wrap("p")}>
                <Pilcrow aria-hidden />
              </button>
              <button type="button" className={appButton({ variant: "ghost", size: "icon-sm" })} aria-label="Madde listesi" onClick={() => insertAtCursor("html", "<ul>\n  <li>", "</li>\n</ul>")}>
                <List aria-hidden />
              </button>
              <button type="button" className={appButton({ variant: "ghost", size: "icon-sm" })} aria-label="Bağlantı" onClick={addLink}>
                <Link2 aria-hidden />
              </button>
            </div>
          </div>
          <Textarea
            id="bc-html"
            ref={htmlRef}
            value={bodyHtml}
            onChange={(e) => setBodyHtml(e.target.value)}
            onFocus={() => setLastFocus("html")}
            rows={14}
            spellCheck={false}
            className="font-mono text-xs leading-relaxed"
          />
          <div className="flex flex-wrap gap-1.5" aria-label="Değişkenler">
            {variables.map((variable) => (
              <button
                key={variable.name}
                type="button"
                title={variable.description}
                onClick={() => insertAtCursor(lastFocus, `{{${variable.name}}}`)}
                className="rounded border border-dashed px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {`{{${variable.name}}}`}
              </button>
            ))}
          </div>
        </div>

        <FormField label="Düz metin sürümü" htmlFor="bc-text" hint="Boş bırakılırsa HTML metinden otomatik oluşturulur.">
          <Textarea id="bc-text" value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={4} className="text-sm" />
        </FormField>

        {channels.includes("SMS") ? (
          <FormField
            label="SMS metni"
            htmlFor="bc-sms"
            required
            hint={
              smsInfo
                ? `${smsInfo.length}/${smsInfo.limit} karakter · ${smsInfo.segments} SMS · ${smsInfo.encoding}${smsInfo.unicodeChars.length ? ` (Türkçe karakter: ${smsInfo.unicodeChars.join(" ")})` : ""} — değişkenler dolunca uzunluk değişebilir`
                : "Kısa tutun; Türkçe karakterler (ş, ğ, ı…) tek SMS sınırını 160'tan 70'e düşürür."
            }
          >
            <Textarea
              id="bc-sms"
              ref={smsRef}
              value={smsText}
              onChange={(e) => setSmsText(e.target.value)}
              onFocus={() => setLastFocus("sms")}
              rows={3}
              maxLength={612}
              className="font-mono text-[13px]"
            />
          </FormField>
        ) : null}
      </FormSection>

      <SectionCard
        title="Önizleme"
        description={rendered ? `Konu: ${rendered.subject}` : "Metin yazdıkça sizin bilgilerinizle önizlenir."}
        actions={
          <button type="button" onClick={sendTest} disabled={testing} className={appButton({ variant: "outline", size: "sm" })}>
            {testing ? <Loader2 aria-hidden className="animate-spin" /> : <Send aria-hidden />}
            Kendime test gönder
          </button>
        }
        flush
      >
        {renderError ? (
          <p role="alert" className="px-5 py-4 text-sm text-red-600 dark:text-red-400">
            {renderError}
          </p>
        ) : null}
        {rendered ? (
          <iframe title="E-posta önizleme" srcDoc={rendered.html} sandbox="" className="block h-[620px] w-full border-0 bg-[#f4f4f5]" />
        ) : (
          <p className="px-5 py-4 text-sm text-muted-foreground">Önizleme hazırlanıyor…</p>
        )}
        {rendered?.sms && channels.includes("SMS") ? (
          <div className="border-t px-5 py-4">
            <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">SMS</p>
            <p className="font-mono text-xs leading-relaxed">{rendered.sms}</p>
          </div>
        ) : null}
        <p className="border-t px-5 py-3 text-xs text-muted-foreground">
          Test, yalnızca size gönderilir: {me.email}
          {channels.includes("SMS") ? ` · ${me.phone ?? "telefon kayıtlı değil"}` : ""}
        </p>
      </SectionCard>

      <FormSection title="Durum sayfası" description="Bakım duyurusunu herkese açık durum sayfasında da yayınlayın.">
        {canPublishStatus ? (
          <>
            <CheckRow
              id="bc-incident"
              checked={publishIncident}
              onChange={() => setPublishIncident(!publishIncident)}
              label="Sistem durumu olayı olarak da yayınla"
              hint="Bileşen bakım durumuna alınır ve bakım penceresiyle bir olay açılır. Taslak kaydederken uygulanmaz."
            />
            {publishIncident ? (
              components.length ? (
                <div className="grid gap-5 sm:grid-cols-3">
                  <FormField label="Bileşen" htmlFor="bc-component" required>
                    <select
                      id="bc-component"
                      value={componentId}
                      onChange={(e) => setComponentId(e.target.value)}
                      className="h-11 w-full rounded-md border bg-background px-3 text-sm md:h-10"
                    >
                      {components.map((component) => (
                        <option key={component.id} value={component.id}>
                          {component.serviceName}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="Bakım başlangıcı" htmlFor="bc-wstart" required>
                    <Input id="bc-wstart" type="datetime-local" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} className="h-11 md:h-10" />
                  </FormField>
                  <FormField label="Bakım bitişi" htmlFor="bc-wend" required>
                    <Input id="bc-wend" type="datetime-local" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} className="h-11 md:h-10" />
                  </FormField>
                </div>
              ) : (
                <p className="rounded-md border border-dashed px-3 py-2.5 text-sm text-muted-foreground">
                  Durum sayfasında bileşen yok. <Link href="/yonetim/durum" className="underline underline-offset-2">Önce bileşen ekleyin</Link>.
                </p>
              )
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Durum sayfasına olay eklemek için “Sistem durumu” yetkisi gerekir.</p>
        )}
      </FormSection>

      <FormSection
        title="Gönderim"
        description={`Mesajlar dakikada en fazla ${rate} adet olarak partiler hâlinde gönderilir. Gönderim sürerken duyuru sayfasından iptal edebilirsiniz.`}
        footer={
          <>
            {error ? (
              <p role="alert" className="mr-auto text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            ) : null}
            <button type="button" disabled={pending} onClick={() => submit("draft")} className={appButton({ variant: "outline" })}>
              Taslak kaydet
            </button>
            <button type="button" disabled={pending} onClick={() => submit(timing)} className={appButton()}>
              {pending ? <Loader2 aria-hidden className="animate-spin" /> : <Send aria-hidden />}
              {timing === "schedule" ? "Zamanla" : "Şimdi gönder"}
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard name="timing" value="now" checked={timing === "now"} onSelect={() => setTiming("now")} title="Şimdi gönder" description="Gönderim hemen başlar." />
          <ChoiceCard name="timing" value="schedule" checked={timing === "schedule"} onSelect={() => setTiming("schedule")} title="Zamanla" description="Seçtiğiniz saatte başlar; alıcı listesi o anda oluşturulur." />
        </div>
        {timing === "schedule" ? (
          <FormField label="Gönderim zamanı" htmlFor="bc-when" required>
            <Input id="bc-when" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="h-11 w-full sm:w-64 md:h-10" />
          </FormField>
        ) : null}
      </FormSection>
    </div>
  );
}

function AudienceSummary({
  preview,
  error,
  counting,
  kind,
  channels,
}: {
  preview: AudiencePreview | null;
  error: string | null;
  counting: boolean;
  kind: Kind;
  channels: Channel[];
}) {
  if (error) {
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        {error}
      </p>
    );
  }
  return (
    <div className="rounded-lg border bg-muted/30">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3" aria-live="polite">
        <p className="flex items-center gap-2 text-sm">
          <Users aria-hidden className="size-4 text-muted-foreground" />
          {preview ? (
            <span>
              <strong className="font-semibold">{preview.total.toLocaleString("tr-TR")}</strong> müşteri
              {channels.includes("SMS") ? <> · {preview.withPhone.toLocaleString("tr-TR")} telefonlu</> : null}
              {kind === "MARKETING" && preview.excludedNoConsent > 0 ? (
                <span className="text-muted-foreground"> · {preview.excludedNoConsent.toLocaleString("tr-TR")} kişi onay vermediği için hariç</span>
              ) : null}
            </span>
          ) : (
            <span className="text-muted-foreground">Hesaplanıyor…</span>
          )}
        </p>
        {counting ? <Loader2 aria-hidden className="size-4 animate-spin text-muted-foreground" /> : null}
      </div>
      {preview && preview.sample.length ? (
        <ul className="divide-y text-sm">
          {preview.sample.map((user) => (
            <li key={user.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 px-4 py-2">
              <Link href={`/yonetim/musteriler/${user.id}`} className="font-medium hover:underline">
                {user.name || user.email}
                {user.companyName ? <span className="font-normal text-muted-foreground"> · {user.companyName}</span> : null}
              </Link>
              <span className="font-mono text-xs text-muted-foreground">
                {user.email}
                {user.phone ? ` · ${user.phone}` : ""}
              </span>
            </li>
          ))}
          {preview.total > preview.sample.length ? (
            <li className="px-4 py-2 text-xs text-muted-foreground">ve {(preview.total - preview.sample.length).toLocaleString("tr-TR")} müşteri daha</li>
          ) : null}
        </ul>
      ) : preview ? (
        <div className="p-3">
          <EmptyState compact icon={Users} title="Bu filtreyle eşleşen müşteri yok" />
        </div>
      ) : null}
    </div>
  );
}
