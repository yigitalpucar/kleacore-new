/**
 * Pure helpers for the ⌘K palette (unit-tested; no React here).
 */

export type PaletteEntry = {
  /** Unique within the palette. */
  key: string;
  title: string;
  subtitle?: string;
  href: string;
  status?: { kind: string; value: string };
  action?: { label: string; href: string };
  /** Short trailing label (nav group name). */
  hint?: string;
};

export type PaletteSection = { key: string; label: string; entries: PaletteEntry[] };

const fold = (s: string) =>
  s
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i");

/** Every word of the query must occur in the haystack (diacritics and case folded: "fatura" finds "Faturalarım", "odeme" finds "Ödeme"). */
export function matchesQuery(haystack: string, query: string) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = fold(haystack);
  return words.every((w) => text.includes(w));
}

/** Sections without entries are dropped; the flat list drives arrow-key navigation. */
export function flattenSections(sections: PaletteSection[]) {
  const visible = sections.filter((s) => s.entries.length > 0);
  const flat: PaletteEntry[] = visible.flatMap((s) => s.entries);
  return { visible, flat };
}

/** Next active index for ArrowUp / ArrowDown / Home / End, wrapping around. */
export function moveActive(current: number, key: string, length: number) {
  if (length === 0) return 0;
  switch (key) {
    case "ArrowDown":
      return (current + 1) % length;
    case "ArrowUp":
      return (current - 1 + length) % length;
    case "Home":
      return 0;
    case "End":
      return length - 1;
    default:
      return current;
  }
}
