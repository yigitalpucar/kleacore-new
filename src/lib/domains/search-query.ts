/** Most TLDs one search request may check (the client asks for more on demand). */
export const MAX_TLDS_PER_SEARCH = 12;

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * What the visitor typed in the domain search box, as the label to search and
 * the extension they typed (if any): "https://www.Ornek.com.tr/x" →
 * { label: "ornek", ext: ".com.tr" }. null when there is no valid label yet.
 * Turkish letters are not allowed in labels (no IDN registration here).
 */
export function parseDomainQuery(raw: string): { label: string; ext: string | null } | null {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#\s]/)[0];
  if (!cleaned) return null;
  const [label, ...rest] = cleaned.split(".");
  if (!LABEL.test(label)) return null;
  const tail = rest.filter(Boolean).join(".");
  const ext = tail && /^[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(tail) ? `.${tail}` : null;
  return { label, ext };
}

/**
 * TLDs to check for one search: the typed extension first (when sold), then
 * the remaining sold TLDs in display order, capped at `limit`.
 */
export function pickSearchTlds(soldInOrder: string[], typedExt: string | null, limit: number): string[] {
  const ordered = typedExt && soldInOrder.includes(typedExt)
    ? [typedExt, ...soldInOrder.filter((ext) => ext !== typedExt)]
    : soldInOrder;
  return ordered.slice(0, limit);
}
