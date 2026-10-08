import { escapeHtml, renderEmailBody, renderTextBody } from "./layout";
import { buildTemplateView, describeTemplateVariables, type TemplateVariable } from "./template-variables";
import type { NotificationTemplate, RenderContext } from "./templates/types";

/**
 * Editable default ("seed") of an admin template, generated from the typed TS
 * template: the TS template is rendered with probe data and every variable
 * value is turned back into its {{token}}. Detail rows and paragraphs that
 * show an optional value are wrapped in {{#name}}…{{/name}}, so they still
 * disappear when the value is missing. Branches on yes/no fields keep the
 * sample's wording (the editor says so). Always regenerated from code, so a
 * change to a TS template is reflected in its default.
 */

export interface TemplateSource {
  subject: string;
  bodyHtml: string;
  bodyText: string;
  sms: string | null;
}

/** Numbers are replaced with distinctive values so they can be found again in the output. */
const PROBE_NUMBER_BASE = 9137;

export function probeData(template: NotificationTemplate) {
  const sample = { ...(template.sample as Record<string, unknown>) };
  describeTemplateVariables(template).forEach((variable, index) => {
    if (variable.kind === "number" && typeof sample[variable.name] === "number") {
      sample[variable.name] = PROBE_NUMBER_BASE + index;
    }
  });
  return sample;
}

function flatten(view: Record<string, unknown>, prefix = ""): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(view)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string" || typeof value === "number") out.push([name, String(value)]);
    else if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
      out.push(...flatten(value as Record<string, unknown>, name));
    }
  }
  return out;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** One-pass, longest-value-first replacement of values with {{tokens}}. */
function tokenizer(pairs: Array<[string, string]>, encode: (value: string) => string) {
  const usable = pairs
    .map(([name, value]) => [name, encode(value)] as const)
    .filter(([, value]) => value.length >= 3)
    // A value shared by several variables maps to the first (template's own before brand).
    .filter(([, value], index, all) => all.findIndex(([, other]) => other === value) === index)
    .sort((a, b) => b[1].length - a[1].length);
  if (usable.length === 0) return (input: string) => input;
  const byValue = new Map(usable.map(([name, value]) => [value, name]));
  const pattern = new RegExp(usable.map(([, value]) => escapeRegExp(value)).join("|"), "g");
  return (input: string) => input.replace(pattern, (match) => `{{${byValue.get(match)}}}`);
}

/** Wraps blocks that print an optional variable in a section for it. */
function guardOptional(html: string, optional: Set<string>, blockPattern: RegExp) {
  return html.replace(blockPattern, (block) => {
    // Links keep their own fallbacks (e.g. invoice list when no invoice id).
    if (block.includes("href=")) return block;
    const used = [...block.matchAll(/\{\{([A-Za-z_][\w.]*)\}\}/g)].map((match) => match[1]).filter((name) => optional.has(name));
    const unique = [...new Set(used)];
    return unique.reduceRight((inner, name) => `{{#${name}}}${inner}{{/${name}}}`, block);
  });
}

const GREETING_SECTION = "{{#recipientName}}Merhaba {{recipientName}},{{/recipientName}}{{^recipientName}}Merhaba,{{/recipientName}}";

export function defaultTemplateSource(template: NotificationTemplate, ctx: RenderContext): TemplateSource {
  const parsed = template.schema.parse(probeData(template));
  const content = template.render(parsed, ctx);
  const view = buildTemplateView(template, parsed, ctx);

  const variables = describeTemplateVariables(template);
  const ownNames = new Set(variables.map((variable) => variable.name));
  // Template's own variables first, then the panel URL, then the brand block.
  const rank = (name: string) => (ownNames.has(name) ? 0 : name === "baseUrl" ? 1 : 2);
  const pairs = flatten(view).sort(([a], [b]) => rank(a) - rank(b));
  const optional = new Set(variables.filter((variable: TemplateVariable) => variable.optional).map((variable) => variable.name));
  optional.delete("recipientName");

  const greets = content.greetingName !== null && ownNames.has("recipientName");
  const htmlTokens = tokenizer(pairs, escapeHtml);
  const textTokens = tokenizer(pairs, (value) => value);

  const GREETING_MARK = "\u0000greeting\u0000";
  let bodyHtml = htmlTokens(renderEmailBody(content, greets ? { greetingHtml: GREETING_MARK } : {}));
  bodyHtml = guardOptional(bodyHtml, optional, /<tr>[\s\S]*?<\/tr>|<p\b[^>]*>[\s\S]*?<\/p>/g);
  bodyHtml = bodyHtml.replace(GREETING_MARK, GREETING_SECTION);

  const textLines = renderTextBody(content, greets ? GREETING_MARK : null).map((line) =>
    line === GREETING_MARK ? GREETING_SECTION : textTokens(line)
  );
  const bodyText = guardOptional(textLines.join("\n"), optional, /^.*$/gm).replace(/\n{3,}/g, "\n\n").trim();

  return {
    subject: textTokens(content.subject),
    bodyHtml,
    bodyText,
    sms: template.sms ? textTokens(template.sms(parsed, ctx)) : null,
  };
}
