import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, SectionCard } from "@/components/app";
import { loadRenderContext, renderNotification } from "@/lib/notifications/render";
import { listTemplates } from "@/lib/notifications/templates";
import { cn } from "@/lib/utils";
import { EmailPreview } from "../email-preview";
import { requirePermission } from "@/lib/utils/auth-helpers";

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
  const rendered = renderNotification(selected.key, selected.sample, await loadRenderContext(), { logo: "inline" });

  const groups = new Map<string, typeof templates>();
  for (const template of templates) {
    groups.set(template.group, [...(groups.get(template.group) ?? []), template]);
  }

  return (
    <>
      <PageHeader
        back={{ href: "/yonetim/bildirimler", label: "Bildirimler" }}
        title="Bildirim şablonları"
        description="Her şablon örnek veriyle işlenir. Firma bilgileri ve destek adresi Ayarlar'dan gelir; e-postalarda dış kaynaklı görsel veya izleme pikseli yoktur."
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
                    {template.label}
                    <span className="block font-mono text-[11px] text-muted-foreground">{template.key}</span>
                  </Link>
                ))}
              </div>
            ))}
          </nav>
        </SectionCard>

        <div className="min-w-0 space-y-6">
          <SectionCard title={selected.label} description={`${selected.key} · ${selected.audience === "admin" ? "yönetime" : "müşteriye"}`}>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Konu</dt>
                <dd>{rendered.subject}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Gizli alanlar</dt>
                <dd className="font-mono text-xs">{selected.sensitive?.join(", ") || "—"}</dd>
              </div>
            </dl>
          </SectionCard>
          <EmailPreview subject={rendered.subject} html={rendered.html} text={rendered.text} sms={rendered.sms} />
        </div>
      </div>
    </>
  );
}
