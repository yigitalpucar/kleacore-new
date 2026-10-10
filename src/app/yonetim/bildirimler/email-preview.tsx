"use client";

import { useMemo, useState } from "react";
import { SectionCard } from "@/components/app";
import { forceDarkPreview } from "@/lib/notifications/layout";
import { cn } from "@/lib/utils";

type Viewport = "desktop" | "mobile";
type Scheme = "light" | "dark";

function Toggle<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 rounded-md border p-0.5">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-9 items-center rounded px-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-7",
              active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Rendered e-mail in a sandboxed iframe (no scripts, no same-origin) + its
 * plain-text part. Desktop / phone (375px) width and the dark-mode palette
 * (as Apple Mail / iOS show it) can be toggled.
 */
export function EmailPreview({ subject, html, text, sms }: { subject: string; html: string; text: string; sms?: string | null }) {
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [scheme, setScheme] = useState<Scheme>("light");
  const srcDoc = useMemo(() => (scheme === "dark" ? forceDarkPreview(html) : html), [html, scheme]);

  return (
    <>
      <SectionCard
        title="E-posta"
        description={subject}
        flush
        actions={
          <>
            <Toggle
              label="Önizleme genişliği"
              value={viewport}
              onChange={setViewport}
              options={[
                { value: "desktop", label: "Masaüstü" },
                { value: "mobile", label: "Mobil" },
              ]}
            />
            <Toggle
              label="Renk teması"
              value={scheme}
              onChange={setScheme}
              options={[
                { value: "light", label: "Açık" },
                { value: "dark", label: "Koyu" },
              ]}
            />
          </>
        }
      >
        <div className={cn("overflow-hidden rounded-b-lg", scheme === "dark" ? "bg-[#09090b]" : "bg-[#fafafa]")}>
          <iframe
            title={`E-posta önizleme: ${subject}`}
            srcDoc={srcDoc}
            sandbox=""
            className={cn(
              "mx-auto block border-0",
              viewport === "mobile" ? "h-[880px] w-[375px] max-w-full border-x border-border" : "h-[760px] w-full"
            )}
          />
        </div>
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
