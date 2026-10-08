import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppBreadcrumbLabel, DetailList, PageHeader, SectionCard, StatusBadge } from "@/components/app";
import { getNotificationLogById } from "@/lib/dal/notification-logs";
import { formatDateTime } from "@/lib/format/date";
import { loadRenderContext, redactSensitive, renderNotification } from "@/lib/notifications/render";
import { getTemplate, hasTemplate } from "@/lib/notifications/templates";
import { EmailPreview } from "../email-preview";
import { ResendButton } from "../resend-button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Bildirim detayı" };

function renderStored(templateKey: string, data: unknown) {
  if (!hasTemplate(templateKey)) return null;
  try {
    const template = getTemplate(templateKey);
    // Secrets stay hidden in the admin view; only the real send decrypts them.
    const safe = redactSensitive(template, (data ?? {}) as Record<string, unknown>);
    return { template, safe };
  } catch {
    return null;
  }
}

export default async function BildirimDetayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const log = await getNotificationLogById(id);
  if (!log) notFound();

  const stored = renderStored(log.template, log.data);
  let rendered: ReturnType<typeof renderNotification> | null = null;
  let renderError: string | null = null;
  if (stored) {
    try {
      rendered = renderNotification(log.template, stored.safe, await loadRenderContext(), { logo: "inline" });
    } catch (error) {
      renderError = error instanceof Error ? error.message : String(error);
    }
  }

  return (
    <>
      <AppBreadcrumbLabel segment={log.id} label={stored?.template.label ?? log.template} />
      <PageHeader
        back={{ href: "/yonetim/bildirimler", label: "Bildirimler" }}
        eyebrow={log.channel === "SMS" ? "SMS" : "E-posta"}
        title={log.subject || stored?.template.label || log.template}
        meta={
          <>
            <StatusBadge kind="notification" status={log.status} size="md" />
            <span className="font-mono">{log.template}</span>
          </>
        }
        actions={<ResendButton id={log.id} status={log.status} />}
      />

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {rendered && log.channel === "EMAIL" ? (
            <EmailPreview subject={rendered.subject} html={rendered.html} text={rendered.text} />
          ) : rendered?.sms ? (
            <SectionCard title="SMS metni">
              <p className="font-mono text-sm">{rendered.sms}</p>
            </SectionCard>
          ) : (
            <SectionCard title="Önizleme">
              <p className="text-sm text-muted-foreground">
                {renderError ? `Şablon işlenemedi: ${renderError}` : "Bu kaydın şablonu artık mevcut değil."}
              </p>
            </SectionCard>
          )}
        </div>
        <SectionCard title="Kayıt">
          <DetailList
            items={[
              { label: "Alıcı", value: log.to, mono: true, copy: log.to },
              {
                label: "Müşteri",
                value: log.user ? `${log.user.name} ${log.user.surname}`.trim() || log.user.email : "Yönetim bildirimi",
              },
              { label: "Oluşturuldu", value: formatDateTime(log.createdAt) },
              { label: "Gönderildi", value: log.sentAt ? formatDateTime(log.sentAt) : null },
              { label: "Deneme", value: String(log.attempts), mono: true },
              { label: "Hata / sebep", value: log.error },
              { label: "Sağlayıcı ileti no", value: log.providerMessageId, mono: true },
              { label: "Tekil anahtar", value: log.dedupeKey, mono: true },
              { label: "Gizli içerik", value: log.redacted ? "Evet — değerler şifreli saklanır, burada gösterilmez" : "Hayır" },
            ]}
          />
        </SectionCard>
      </div>
    </>
  );
}
