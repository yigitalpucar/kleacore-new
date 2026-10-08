import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, SectionCard, StatusBadge, appButton } from "@/components/app";
import { db } from "@/lib/db";
import { loadRenderContext, renderNotification } from "@/lib/notifications/render";
import { getActiveOverrideKeys, getTemplateEditorState } from "@/lib/notifications/template-admin";
import { listTemplates } from "@/lib/notifications/templates";
import { cn } from "@/lib/utils";
import { requirePermission } from "@/lib/utils/auth-helpers";
import { TemplateEditor } from "./template-editor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Bildirim şablonları" };

export default async function SablonlarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("settings.manage");
  const sp = await searchParams;
  const templates = listTemplates();
  const selectedKey = typeof sp.t === "string" ? sp.t : templates[0]?.key;
  const selected = templates.find((template) => template.key === selectedKey) ?? templates[0];
  const channel = sp.c === "SMS" && selected.sms ? "SMS" : "EMAIL";

  const ctx = await loadRenderContext();
  const [state, active] = await Promise.all([getTemplateEditorState(selected.key, ctx), getActiveOverrideKeys()]);
  const row = channel === "SMS" ? state.sms : state.email;
  const userIds = [...new Set((row?.versions ?? []).map((version) => version.updatedBy).filter((id): id is string => Boolean(id)))];
  const users = userIds.length
    ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, surname: true, email: true } })
    : [];
  const userName = (id: string | null) => {
    const user = users.find((item) => item.id === id);
    return user ? `${user.name ?? ""} ${user.surname ?? ""}`.trim() || user.email : "—";
  };

  // Editor starts from the active override, else from the code default.
  const defaults = state.defaults;
  const initial =
    row?.isActive
      ? { subject: row.subject, bodyHtml: row.bodyHtml, bodyText: row.bodyText }
      : channel === "SMS"
        ? { subject: "", bodyHtml: "", bodyText: defaults.sms ?? "" }
        : { subject: defaults.subject, bodyHtml: defaults.bodyHtml, bodyText: defaults.bodyText };
  const defaultDraft =
    channel === "SMS"
      ? { subject: "", bodyHtml: "", bodyText: defaults.sms ?? "" }
      : { subject: defaults.subject, bodyHtml: defaults.bodyHtml, bodyText: defaults.bodyText };

  const current = renderNotification(selected.key, selected.sample, ctx, { logo: "inline" });
  const activeKeys = new Set(active.map((item) => item.key));

  const groups = new Map<string, typeof templates>();
  for (const template of templates) {
    groups.set(template.group, [...(groups.get(template.group) ?? []), template]);
  }

  return (
    <>
      <PageHeader
        back={{ href: "/yonetim/bildirimler", label: "Bildirimler" }}
        title="Bildirim şablonları"
        description="Her bildirimin konusu ve metni buradan düzenlenebilir. Kayıtlı bir düzenleme yoksa koddaki varsayılan şablon kullanılır; değişkenler gönderimde güvenli biçimde doldurulur."
        actions={
          <Link href="/yonetim/bildirimler/hatirlatmalar" className={appButton({ variant: "outline" })}>
            Hatırlatma takvimi
          </Link>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <SectionCard title="Şablonlar" flush>
          <nav aria-label="Şablonlar" className="max-h-[70vh] overflow-y-auto p-2">
            {[...groups.entries()].map(([group, items]) => (
              <div key={group} className="mb-2">
                <p className="px-2 pb-1 pt-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{group}</p>
                {items.map((template) => (
                  <Link
                    key={template.key}
                    href={`/yonetim/bildirimler/sablonlar?t=${encodeURIComponent(template.key)}`}
                    aria-current={template.key === selected.key ? "page" : undefined}
                    className={cn(
                      "block rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted",
                      template.key === selected.key && "bg-muted font-medium"
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      {template.label}
                      {activeKeys.has(template.key) ? <StatusBadge tone="info" label="Düzenlendi" /> : null}
                    </span>
                    <span className="block font-mono text-[11px] text-muted-foreground">{template.key}</span>
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        </SectionCard>

        <div className="min-w-0 space-y-6">
          <TemplateEditor
            key={`${selected.key}:${channel}:${row?.version ?? 0}`}
            templateKey={selected.key}
            label={selected.label}
            audience={selected.audience}
            channel={channel}
            hasSms={Boolean(selected.sms)}
            sensitive={[...(selected.sensitive ?? [])]}
            variables={state.variables}
            initial={initial}
            defaults={defaultDraft}
            override={row ? { isActive: row.isActive, version: row.version, updatedAt: row.updatedAt.toISOString() } : null}
            versions={(row?.versions ?? []).map((version) => ({
              id: version.id,
              version: version.version,
              action: version.action,
              isActive: version.isActive,
              createdAt: version.createdAt.toISOString(),
              by: userName(version.updatedBy),
            }))}
            initialPreview={{ subject: current.subject, html: current.html, text: current.text, sms: current.sms }}
          />
        </div>
      </div>
    </>
  );
}
