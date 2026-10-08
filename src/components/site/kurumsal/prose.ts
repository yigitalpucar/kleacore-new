/**
 * Readable long-form text styles (the project has no typography plugin).
 * Applies to plain h2/h3/p/ul/ol/li/strong/a/code/table children.
 * Wrap custom blocks in `.not-prose` to opt out.
 */
export const proseClasses = [
  "text-[15px] leading-7 text-foreground/85 sm:text-base sm:leading-[1.8]",
  // headings
  "[&_h2:not(.not-prose_*)]:mt-14 [&_h2:not(.not-prose_*)]:scroll-mt-28 [&_h2:not(.not-prose_*)]:text-2xl [&_h2:not(.not-prose_*)]:font-semibold [&_h2:not(.not-prose_*)]:tracking-tight [&_h2:not(.not-prose_*)]:text-foreground",
  "[&>section:first-child>h2]:mt-0 [&>h2:first-child]:mt-0 [&>p:first-child]:mt-0",
  "[&_h3:not(.not-prose_*)]:mt-8 [&_h3:not(.not-prose_*)]:scroll-mt-28 [&_h3:not(.not-prose_*)]:text-lg [&_h3:not(.not-prose_*)]:font-semibold [&_h3:not(.not-prose_*)]:tracking-tight [&_h3:not(.not-prose_*)]:text-foreground",
  // paragraphs & lists
  "[&_p:not(.not-prose_*)]:mt-4",
  "[&_ul:not(.not-prose_*)]:mt-4 [&_ul:not(.not-prose_*)]:list-disc [&_ul:not(.not-prose_*)]:space-y-2 [&_ul:not(.not-prose_*)]:pl-5 [&_ul:not(.not-prose_*)]:marker:text-foreground/40",
  "[&_ol:not(.not-prose_*)]:mt-4 [&_ol:not(.not-prose_*)]:list-decimal [&_ol:not(.not-prose_*)]:space-y-2 [&_ol:not(.not-prose_*)]:pl-5 [&_ol:not(.not-prose_*)]:marker:text-foreground/50",
  "[&_li:not(.not-prose_*)]:pl-1",
  // inline
  "[&_strong:not(.not-prose_*)]:font-semibold [&_strong:not(.not-prose_*)]:text-foreground",
  "[&_a:not(.not-prose_*)]:font-medium [&_a:not(.not-prose_*)]:text-foreground [&_a:not(.not-prose_*)]:underline [&_a:not(.not-prose_*)]:decoration-foreground/30 [&_a:not(.not-prose_*)]:underline-offset-4 [&_a:not(.not-prose_*):hover]:decoration-foreground",
  "[&_code:not(.not-prose_*)]:rounded [&_code:not(.not-prose_*)]:border [&_code:not(.not-prose_*)]:bg-muted/60 [&_code:not(.not-prose_*)]:px-1.5 [&_code:not(.not-prose_*)]:py-0.5 [&_code:not(.not-prose_*)]:font-mono [&_code:not(.not-prose_*)]:text-[0.85em]",
].join(" ");
