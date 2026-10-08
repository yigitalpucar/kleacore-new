import { SectionCard } from "@/components/app";

/** Rendered e-mail in a sandboxed iframe (no scripts, no same-origin) + its plain-text part. */
export function EmailPreview({ subject, html, text, sms }: { subject: string; html: string; text: string; sms?: string | null }) {
  return (
    <>
      <SectionCard title="E-posta" description={subject} flush>
        <iframe
          title={`E-posta önizleme: ${subject}`}
          srcDoc={html}
          sandbox=""
          className="block h-[760px] w-full rounded-b-lg border-0 bg-[#f4f4f5]"
        />
      </SectionCard>
      <SectionCard title="Düz metin sürümü" headingLevel={3}>
        <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-muted-foreground">{text}</pre>
      </SectionCard>
      {sms ? (
        <SectionCard title="SMS metni" description={`${sms.length} karakter`} headingLevel={3}>
          <p className="font-mono text-xs leading-relaxed">{sms}</p>
        </SectionCard>
      ) : null}
    </>
  );
}
