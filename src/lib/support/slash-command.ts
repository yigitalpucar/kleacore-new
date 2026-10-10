/**
 * "/" canned reply picker in the staff reply box (UI3 item 13). Pure
 * helpers: find the "/query" being typed at the caret and replace it.
 */

const MAX_QUERY = 40;

/**
 * The slash token ending at `caret`: "/" at the start of a line or after a
 * space, followed by up to 40 characters without a line break. Returns
 * null when the caret is not in such a token (e.g. "1/2", a URL).
 */
export function findSlashQuery(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const slash = before.lastIndexOf("/");
  if (slash < 0) return null;
  const prev = slash === 0 ? "" : before[slash - 1];
  if (prev !== "" && prev !== " " && prev !== "\n" && prev !== "\t") return null;
  const query = before.slice(slash + 1);
  if (query.length > MAX_QUERY || /[\n/]/.test(query) || query.startsWith(" ")) return null;
  return { start: slash, query };
}

/** Replaces text[start, caret) with `insert`; returns the new text and caret. */
export function replaceSlashQuery(text: string, start: number, caret: number, insert: string) {
  const next = text.slice(0, start) + insert + text.slice(caret);
  return { text: next, caret: start + insert.length };
}

const tr = (s: string) => s.toLocaleLowerCase("tr-TR");

/** Title matches first, then body matches; keeps the given (usage) order inside each group. */
export function filterCannedReplies<T extends { title: string; body: string }>(replies: T[], query: string, limit = 8): T[] {
  const q = tr(query.trim());
  if (!q) return replies.slice(0, limit);
  const inTitle = replies.filter((r) => tr(r.title).includes(q));
  const inBody = replies.filter((r) => !tr(r.title).includes(q) && tr(r.body).includes(q));
  return [...inTitle, ...inBody].slice(0, limit);
}
