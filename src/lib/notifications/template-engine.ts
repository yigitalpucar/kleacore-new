/**
 * Small, logic-less {{mustache}}-style renderer for admin-edited notification
 * templates. No code execution of any kind (no eval, no helpers, no partials,
 * no raw/triple-stash output): templates can only print whitelisted values
 * and show/hide/repeat blocks.
 *
 *   {{name}}              value (HTML-escaped in HTML mode)
 *   {{brand.siteName}}    dotted lookup
 *   {{#name}}…{{/name}}   block shown when truthy; repeated for each list item
 *   {{^name}}…{{/name}}   block shown when falsy / empty list
 *   {{.}}                 the current list item (inside a list block)
 *   {{! comment }}        ignored
 */

export type TemplateNode =
  | { kind: "text"; value: string }
  | { kind: "var"; name: string; offset: number }
  | { kind: "section"; name: string; inverted: boolean; children: TemplateNode[]; offset: number };

export interface TemplateError {
  message: string;
  /** Character offset in the source. */
  offset: number;
}

export type ParseResult = { ok: true; nodes: TemplateNode[] } | { ok: false; errors: TemplateError[] };

const NAME = /^(?:\.|[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)$/;
const MAX_DEPTH = 8;
const MAX_LENGTH = 100_000;

export function parseTemplate(source: string): ParseResult {
  const errors: TemplateError[] = [];
  if (source.length > MAX_LENGTH) {
    return { ok: false, errors: [{ message: `Şablon çok uzun (en fazla ${MAX_LENGTH} karakter).`, offset: 0 }] };
  }

  const root: TemplateNode[] = [];
  const stack: Array<{ name: string; offset: number; children: TemplateNode[] }> = [];
  const current = () => (stack.length ? stack[stack.length - 1].children : root);

  let index = 0;
  while (index < source.length) {
    const open = source.indexOf("{{", index);
    if (open === -1) {
      current().push({ kind: "text", value: source.slice(index) });
      break;
    }
    if (open > index) current().push({ kind: "text", value: source.slice(index, open) });

    if (source.startsWith("{{{", open)) {
      errors.push({ message: "Ham çıktı ({{{ … }}}) desteklenmez; değerler her zaman güvenli biçimde yazılır.", offset: open });
      const end = source.indexOf("}}}", open);
      index = end === -1 ? source.length : end + 3;
      continue;
    }

    const close = source.indexOf("}}", open + 2);
    if (close === -1) {
      errors.push({ message: "Kapanmamış etiket: '{{' için '}}' bulunamadı.", offset: open });
      break;
    }

    const raw = source.slice(open + 2, close).trim();
    index = close + 2;
    const sigil = raw[0];

    if (sigil === "!") continue;

    if (sigil === "#" || sigil === "^") {
      const name = raw.slice(1).trim();
      if (!NAME.test(name) || name === ".") {
        errors.push({ message: `Geçersiz blok adı: "${raw}"`, offset: open });
        continue;
      }
      if (stack.length >= MAX_DEPTH) {
        errors.push({ message: `Bloklar en fazla ${MAX_DEPTH} seviye iç içe olabilir.`, offset: open });
        continue;
      }
      const section: TemplateNode = { kind: "section", name, inverted: sigil === "^", children: [], offset: open };
      current().push(section);
      stack.push({ name, offset: open, children: section.children });
      continue;
    }

    if (sigil === "/") {
      const name = raw.slice(1).trim();
      const top = stack[stack.length - 1];
      if (!top) {
        errors.push({ message: `Açılmamış blok kapatılıyor: "{{/${name}}}"`, offset: open });
      } else if (top.name !== name) {
        errors.push({ message: `"{{#${top.name}}}" bloğu "{{/${name}}}" ile kapatılamaz.`, offset: open });
      } else {
        stack.pop();
      }
      continue;
    }

    if (sigil === "&" || sigil === ">" || sigil === "=" || sigil === "{") {
      errors.push({ message: `Desteklenmeyen etiket: "{{${raw}}}"`, offset: open });
      continue;
    }

    if (!NAME.test(raw)) {
      errors.push({ message: `Geçersiz değişken: "{{${raw}}}"`, offset: open });
      continue;
    }
    current().push({ kind: "var", name: raw, offset: open });
  }

  for (const open of stack) {
    errors.push({ message: `"{{#${open.name}}}" bloğu kapatılmamış.`, offset: open.offset });
  }

  return errors.length ? { ok: false, errors } : { ok: true, nodes: root };
}

/** Every variable / block name used, with the names of its enclosing blocks. */
export function collectNames(nodes: TemplateNode[], scope: string[] = []): Array<{ name: string; scope: string[]; offset: number; section: boolean }> {
  const out: Array<{ name: string; scope: string[]; offset: number; section: boolean }> = [];
  for (const node of nodes) {
    if (node.kind === "var") out.push({ name: node.name, scope, offset: node.offset, section: false });
    if (node.kind === "section") {
      out.push({ name: node.name, scope, offset: node.offset, section: true });
      out.push(...collectNames(node.children, node.inverted ? scope : [...scope, node.name]));
    }
  }
  return out;
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

type Context = unknown;

function lookup(stack: Context[], name: string): unknown {
  if (name === ".") return stack[stack.length - 1];
  const [head, ...rest] = name.split(".");
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    const frame = stack[i];
    if (frame && typeof frame === "object" && !Array.isArray(frame) && Object.prototype.hasOwnProperty.call(frame, head)) {
      let value: unknown = (frame as Record<string, unknown>)[head];
      for (const part of rest) {
        if (!value || typeof value !== "object" || Array.isArray(value) || !Object.prototype.hasOwnProperty.call(value, part)) {
          return undefined;
        }
        value = (value as Record<string, unknown>)[part];
      }
      return value;
    }
  }
  return undefined;
}

function toText(value: unknown): string {
  if (value === null || value === undefined || value === false) return "";
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(", ");
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return "";
  return String(value);
}

function isTruthy(value: unknown) {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value) && value !== "0";
}

function renderNodes(nodes: TemplateNode[], stack: Context[], escape: boolean): string {
  let out = "";
  for (const node of nodes) {
    if (node.kind === "text") {
      out += node.value;
    } else if (node.kind === "var") {
      const text = toText(lookup(stack, node.name));
      out += escape ? escapeHtml(text) : text;
    } else {
      const value = lookup(stack, node.name);
      if (node.inverted) {
        if (!isTruthy(value)) out += renderNodes(node.children, stack, escape);
      } else if (Array.isArray(value)) {
        for (const item of value) out += renderNodes(node.children, [...stack, item], escape);
      } else if (isTruthy(value)) {
        out += renderNodes(node.children, typeof value === "object" ? [...stack, value] : stack, escape);
      }
    }
  }
  return out;
}

/**
 * Renders parsed nodes. `escape: true` for HTML bodies (every value is
 * HTML-escaped), false for subjects, plain text and SMS.
 */
export function renderNodesToString(nodes: TemplateNode[], context: Record<string, unknown>, options: { escape: boolean }) {
  return renderNodes(nodes, [context], options.escape);
}

/** Parse + render; throws on a parse error (templates are validated on save). */
export function renderTemplate(source: string, context: Record<string, unknown>, options: { escape: boolean }) {
  const parsed = parseTemplate(source);
  if (!parsed.ok) throw new Error(parsed.errors.map((error) => error.message).join(" "));
  return renderNodesToString(parsed.nodes, context, options);
}

/**
 * Admin HTML is trusted markup but still goes to customers' mail clients:
 * scripts, embeds, event handlers and javascript: URLs are removed.
 */
export function sanitizeEmailHtml(html: string) {
  const blocked = "script|style|iframe|object|embed|form|input|button|textarea|select|link|meta|base|svg|math";
  return html
    .replace(new RegExp(`<\\s*(${blocked})\\b[^>]*>[\\s\\S]*?<\\s*\\/\\s*\\1\\s*>`, "gi"), "")
    .replace(new RegExp(`<\\s*\\/?\\s*(${blocked})\\b[^>]*>`, "gi"), "")
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*(javascript|vbscript|data):[^"']*\2/gi, '$1="#"')
    .replace(/(href|src)\s*=\s*(javascript|vbscript|data):[^\s>]*/gi, '$1="#"');
}
