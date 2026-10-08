/** Minimal XML writer: escaped text/attributes, no external template engine. */

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    // Strip characters that are illegal in XML 1.0 (control chars except tab/newline/CR).
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

export type XmlAttrs = Record<string, string | number | boolean | null | undefined>;
export type XmlChild = string | null | undefined | false | XmlChild[];

function renderAttrs(attrs?: XmlAttrs) {
  if (!attrs) return "";
  return Object.entries(attrs)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => ` ${key}="${escapeXml(String(value))}"`)
    .join("");
}

function renderChildren(children: XmlChild[]): string {
  return children
    .map((child) => {
      if (child === null || child === undefined || child === false) return "";
      if (Array.isArray(child)) return renderChildren(child);
      return child;
    })
    .join("");
}

/** Element with already-rendered children (use `text()` for leaf values). */
export function el(name: string, attrs: XmlAttrs | null, ...children: XmlChild[]): string {
  const inner = renderChildren(children);
  return inner ? `<${name}${renderAttrs(attrs ?? undefined)}>${inner}</${name}>` : `<${name}${renderAttrs(attrs ?? undefined)}/>`;
}

/** Leaf element with escaped text; omitted entirely when value is empty. */
export function text(name: string, value: string | number | null | undefined, attrs?: XmlAttrs): string {
  if (value === null || value === undefined || value === "") return "";
  return `<${name}${renderAttrs(attrs)}>${escapeXml(String(value))}</${name}>`;
}
