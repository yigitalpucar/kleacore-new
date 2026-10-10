"use client";

import { useId, useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { GridLineHorizontal } from "./grid-lines";
import { Section, type SectionProps } from "./section";
import { SectionHeading } from "./section-heading";

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqGroup {
  title: string;
  items: FaqItem[];
}

/**
 * Accordion list with dashed separators (Aceternity "FAQs with dashed lines").
 * One item open at a time. Keyboard: native <button>, aria-expanded/controls.
 */
export function FaqList({
  items,
  groups,
  className,
}: {
  items?: FaqItem[];
  groups?: FaqGroup[];
  className?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const baseId = useId();
  const allGroups: FaqGroup[] = groups ?? [{ title: "", items: items ?? [] }];
  // Questions sit one level below the group title (if any).
  const QuestionHeading = groups ? "h4" : "h3";

  return (
    <div className={cn("flex flex-col gap-12", className)}>
      {allGroups.map((group, gi) => (
        <div key={group.title || gi}>
          {group.title ? (
            <h3 className="mb-4 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
              {group.title}
            </h3>
          ) : null}
          <ul className="relative">
            <GridLineHorizontal className="top-0" fade={false} />
            {group.items.map((item, index) => {
              const id = `${baseId}-${gi}-${index}`;
              const open = openId === id;
              return (
                <li key={item.question} className="relative">
                  <QuestionHeading className="m-0">
                    <button
                      type="button"
                      id={`${id}-trigger`}
                      aria-expanded={open}
                      aria-controls={`${id}-panel`}
                      onClick={() => setOpenId(open ? null : id)}
                      className="flex min-h-14 w-full items-center justify-between gap-6 py-4 text-left text-base font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-2"
                    >
                      <span className="text-pretty">{item.question}</span>
                      <span
                        aria-hidden
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-md border bg-background transition-transform duration-200",
                          open && "rotate-45"
                        )}
                      >
                        <Plus className="size-3.5" />
                      </span>
                    </button>
                  </QuestionHeading>
                  {open ? (
                    <div
                      id={`${id}-panel`}
                      role="region"
                      aria-labelledby={`${id}-trigger`}
                      className="overflow-hidden motion-safe:duration-200 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1"
                    >
                      <p className="max-w-3xl pb-5 text-sm leading-relaxed text-muted-foreground sm:px-2 sm:text-base">
                        {item.answer}
                      </p>
                    </div>
                  ) : null}
                  <GridLineHorizontal className="bottom-0" fade={false} />
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export interface FaqSectionProps extends Omit<SectionProps, "title" | "children"> {
  items?: FaqItem[];
  groups?: FaqGroup[];
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Emit FAQPage JSON-LD (default true). Use once per page. */
  jsonLd?: boolean;
}

/** Section wrapper: heading on the left, accordion on the right (desktop). */
export function FaqSection({
  items,
  groups,
  eyebrow = "SSS",
  title = "Sık sorulan sorular",
  description,
  jsonLd = true,
  ...sectionProps
}: FaqSectionProps) {
  const flat = groups ? groups.flatMap((g) => g.items) : (items ?? []);
  if (flat.length === 0) return null;

  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: flat.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };

  return (
    <Section {...sectionProps}>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-16">
        <SectionHeading
          eyebrow={eyebrow}
          title={title}
          description={
            description ?? (
              <>
                Aradığınızı bulamadıysanız{" "}
                <a
                  href="mailto:support@kleacore.com"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  support@kleacore.com
                </a>{" "}
                adresine yazın.
              </>
            )
          }
          className="lg:sticky lg:top-28 lg:self-start"
        />
        <FaqList items={items} groups={groups} />
      </div>
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ) : null}
    </Section>
  );
}
