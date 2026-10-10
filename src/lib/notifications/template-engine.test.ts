import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { parseTemplate, renderTemplate, sanitizeEmailHtml } from "./template-engine";
import { DEFAULT_BRAND, renderNotification } from "./render";
import { defaultTemplateSource, probeData } from "./template-defaults";
import { buildTemplateView, validateTemplateFields } from "./template-variables";
import { getTemplate, listTemplates } from "./templates";
import { renderEmailBody } from "./layout";

const ctx = { brand: DEFAULT_BRAND, baseUrl: "https://kleacore.test" };

describe("template engine", () => {
  it("escapes every value in HTML mode and never interprets markup in data", () => {
    const html = renderTemplate("<p>Merhaba {{name}}</p>", { name: '<script>alert("x")</script>&' }, { escape: true });
    expect(html).toBe("<p>Merhaba &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&amp;</p>");
    // Plain text / subjects are not HTML-escaped.
    expect(renderTemplate("Konu: {{name}}", { name: "A & B" }, { escape: false })).toBe("Konu: A & B");
  });

  it("has no code paths: raw output, partials, delimiters and expressions are rejected", () => {
    for (const source of ["{{{name}}}", "{{&name}}", "{{> partial}}", "{{=<% %>=}}", "{{constructor.constructor('x')()}}", "{{a + b}}"]) {
      expect(parseTemplate(source).ok).toBe(false);
    }
  });

  it("does not reach prototype properties", () => {
    expect(renderTemplate("{{constructor}}{{name.constructor}}{{__proto__}}", { name: "x" }, { escape: false })).toBe("");
  });

  it("supports sections, inverted sections, lists and dotted names", () => {
    const view = { a: true, b: "", list: ["x", "y"], rows: [{ label: "L", value: "V" }], brand: { siteName: "KLEACORE" } };
    expect(
      renderTemplate(
        "{{#a}}A{{/a}}{{^b}}!B{{/b}}{{#list}}[{{.}}]{{/list}}{{#rows}}{{label}}={{value}}{{/rows}} {{brand.siteName}} {{list}}",
        view,
        { escape: false }
      )
    ).toBe("A!B[x][y]L=V KLEACORE x, y");
  });

  it("reports unclosed and mismatched blocks", () => {
    expect(parseTemplate("{{#a}}x").ok).toBe(false);
    expect(parseTemplate("{{#a}}x{{/b}}").ok).toBe(false);
    expect(parseTemplate("{{/a}}").ok).toBe(false);
  });

  it("strips scripts, handlers and javascript: links from admin HTML", () => {
    const dirty = '<p onclick="steal()">Hi</p><script>alert(1)</script><a href="javascript:alert(1)">x</a><iframe src="//evil"></iframe>';
    const clean = sanitizeEmailHtml(dirty);
    expect(clean).not.toMatch(/script|onclick|javascript:|iframe/i);
    expect(clean).toContain("<p>Hi</p>");
  });
});

describe("variable whitelist", () => {
  const invoiceCreated = getTemplate("billing.invoice-created");

  it("accepts the template's own variables, brand values and list item keys", () => {
    expect(
      validateTemplateFields(invoiceCreated, {
        subject: "{{invoiceNumber}} — {{brand.siteName}}",
        bodyHtml: "<p>{{#recipientName}}Merhaba {{recipientName}}{{/recipientName}} {{totalAmount}} {{dueDate}} {{baseUrl}}</p>",
      })
    ).toEqual([]);
    expect(
      validateTemplateFields(getTemplate("admin.event-alert"), { bodyHtml: "{{#details}}{{label}}: {{value}}{{/details}}" })
    ).toEqual([]);
  });

  it("rejects unknown variables and {{.}} outside a list", () => {
    const errors = validateTemplateFields(invoiceCreated, {
      subject: "{{invoiceNo}}",
      bodyHtml: "{{password}} {{.}} {{#details}}{{label}}{{/details}}",
    });
    expect(errors.map((error) => error.message)).toEqual([
      expect.stringContaining("{{invoiceNo}}"),
      expect.stringContaining("{{password}}"),
      expect.stringContaining("{{.}}"),
      expect.stringContaining("{{details}}"),
      expect.stringContaining("{{label}}"),
    ]);
    expect(errors[0].field).toBe("subject");
  });

  it("formats money and dates in the view", () => {
    const parsed = invoiceCreated.schema.parse(invoiceCreated.sample);
    const view = buildTemplateView(invoiceCreated, parsed, ctx);
    expect(view.totalAmount).toMatch(/599,94/);
    expect(view.dueDate).toBe("15.10.2026");
  });
});

describe("default (seed) sources generated from the TS templates", () => {
  it.each(listTemplates().filter((template) => template.editable !== false).map((template) => [template.key, template] as const))(
    "%s: the default is valid and renders exactly like the TS template",
    (_key, template) => {
      const source = defaultTemplateSource(template, ctx);
      const fields = { subject: source.subject, bodyHtml: source.bodyHtml, bodyText: source.bodyText, ...(source.sms ? { sms: source.sms } : {}) };
      expect(validateTemplateFields(template, fields)).toEqual([]);

      const parsed = template.schema.parse(probeData(template));
      const view = buildTemplateView(template, parsed, ctx);
      const content = template.render(parsed, ctx);
      expect(renderTemplate(source.subject, view, { escape: false })).toBe(content.subject);
      expect(renderTemplate(source.bodyHtml, view, { escape: true })).toBe(renderEmailBody(content));
      if (source.sms) expect(renderTemplate(source.sms, view, { escape: false })).toBe(template.sms!(parsed, ctx));
    }
  );

  it("an active override replaces the TS template; without one the TS template is used", () => {
    const template = getTemplate("billing.invoice-created");
    const fallback = renderNotification(template.key, template.sample, ctx);
    const overridden = renderNotification(template.key, template.sample, ctx, {
      override: {
        email: { subject: "Fatura {{invoiceNumber}} hazır", bodyHtml: "<p>Tutar: {{totalAmount}}</p>", bodyText: "", version: 2 },
      },
    });
    expect(overridden.subject).toBe("Fatura F-2026-000456 hazır");
    expect(overridden.html).toContain("<p>Tutar: 599,94");
    expect(overridden.html).toContain('<html lang="tr"'); // branded shell
    expect(overridden.text).toContain("Tutar: 599,94");
    expect(fallback.subject).toBe("Yeni faturanız: F-2026-000456");
  });

  it("falls back to the TS template when an override can't be rendered", () => {
    const template = getTemplate("billing.invoice-created");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const rendered = renderNotification(template.key, template.sample, ctx, {
      override: { email: { subject: "{{#broken}}", bodyHtml: "x", bodyText: "", version: 3 } },
    });
    expect(rendered.subject).toBe("Yeni faturanız: F-2026-000456");
  });

  it("uses an SMS override only for templates that send SMS", () => {
    const template = getTemplate("billing.payment-received");
    const rendered = renderNotification(template.key, template.sample, ctx, {
      override: { sms: { text: "{{brand.siteName}}: {{invoiceNumber}} ödendi, {{paidAmount}}", version: 1 } },
    });
    expect(rendered.sms).toMatch(/^KLEACORE: F-2026-000456 ödendi, 1\.199,88/);
  });
});
