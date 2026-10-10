import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: { setting: { findMany: async () => [] } } }));

import {
  forceDarkPreview,
  renderButton,
  renderDetailsTable,
  renderEmailLayout,
  renderEmailShell,
  renderRawEmail,
} from "./layout";
import { DEFAULT_BRAND, renderNotification } from "./render";
import { listTemplates } from "./templates";
import type { EmailContent, RenderContext } from "./templates/types";

const brand = {
  ...DEFAULT_BRAND,
  companyName: "KLEAWORK DIGITAL LLC",
  companyAddress: "30 N Gould St Ste R, Sheridan, WY 82801, USA",
  supportEmail: "support@kleacore.com",
  siteUrl: "https://kleacore.com",
};
const ctx: RenderContext = { brand, baseUrl: "https://kleacore.com" };
const shell = { logoSrc: "cid:kleacore-logo" };

const content: EmailContent = {
  subject: "Yeni faturanız: F-1",
  heading: "Yeni faturanız oluşturuldu",
  greetingName: "Ayşe",
  intro: ["F-1 numaralı faturanız oluşturuldu."],
  details: [
    { label: "Fatura", value: "F-1", mono: true },
    { label: "Tutar", value: "599,94 ₺", emphasis: true },
  ],
  action: { label: "Faturayı öde", url: "https://kleacore.com/musteri/panel/faturalar/1" },
  note: "Not",
};

describe("email layout", () => {
  it("renders the branded shell (snapshot)", () => {
    const { html } = renderEmailLayout(content, brand, { ...shell, eyebrow: "Sipariş ve fatura" });
    expect(html).toMatchSnapshot();
  });

  it("is a 600px, table-based, dark-mode aware document", () => {
    const { html } = renderEmailLayout(content, brand, shell);
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain('<meta name="color-scheme" content="light dark" />');
    expect(html).toContain('<meta name="supported-color-schemes" content="light dark" />');
    expect(html).toContain("@media (prefers-color-scheme:dark)");
    expect(html).toContain("max-width:600px");
    expect(html).toContain('<!--[if mso]><table role="presentation" width="600"');
    expect(html).toContain('src="cid:kleacore-logo" width="144" height="31"');
    expect(html).not.toMatch(/<img[^>]+src="https?:/i);
  });

  it("puts the preheader in a hidden block before the body", () => {
    const { html, preheader } = renderEmailLayout({ ...content, preheader: "Gizli <önizleme>" }, brand, shell);
    expect(preheader).toBe("Gizli <önizleme>");
    expect(html).toMatch(/<div style="display:none;[^"]*mso-hide:all">Gizli &lt;önizleme&gt;/);
    expect(html.indexOf("Gizli &lt;önizleme&gt;")).toBeLessThan(html.indexOf("<h1"));
  });

  it("has a company footer with a support link and no unsubscribe link on transactional mail", () => {
    const { html, text } = renderEmailLayout(content, brand, shell);
    expect(html).toContain("KLEAWORK DIGITAL LLC");
    expect(html).toContain("30 N Gould St Ste R, Sheridan, WY 82801, USA");
    expect(html).toContain('href="mailto:support@kleacore.com"');
    expect(html).not.toContain("Kampanya e-postalarından çık");
    expect(text).toContain("Destek: support@kleacore.com");
    expect(text).toContain("kleacore.com");
  });

  it("adds the unsubscribe link only when the mail is marketing", () => {
    const marketing = renderRawEmail(
      { subject: "Kampanya", preheader: "p", bodyHtml: "<p>x</p>", text: "x", unsubscribeUrl: "https://kleacore.com/abonelik/iptal?t=1" },
      brand,
      shell
    );
    expect(marketing.html).toContain('href="https://kleacore.com/abonelik/iptal?t=1"');
    expect(marketing.text).toContain("Kampanya e-postalarından çıkmak için: https://kleacore.com/abonelik/iptal?t=1");
    const service = renderRawEmail({ subject: "Bakım", preheader: "p", bodyHtml: "<p>x</p>", text: "x" }, brand, shell);
    expect(service.html).not.toContain("abonelik/iptal");
  });

  it("renders a bulletproof CTA and refuses unsafe URLs", () => {
    const button = renderButton({ label: "Öde", url: "https://kleacore.com/x?a=1&b=2" });
    expect(button).toContain('bgcolor="#09090b"');
    expect(button).toContain("mso-padding-alt:13px 24px");
    expect(button).toContain('href="https://kleacore.com/x?a=1&amp;b=2"');
    expect(renderButton({ label: "x", url: "javascript:alert(1)" })).toContain('href="#"');
    expect(renderButton(undefined)).toBe("");
  });

  it("renders the summary table with emphasised amounts", () => {
    const table = renderDetailsTable(content.details);
    expect(table).toContain('class="kc-table"');
    expect(table.match(/<tr class="kc-row">/g)).toHaveLength(2);
    expect(table).toMatch(/font-size:16px;[^"]*font-weight:700[^>]*>599,94 ₺/);
    expect(renderDetailsTable([])).toBe("");
  });

  it("forceDarkPreview applies the dark palette unconditionally", () => {
    const { html } = renderEmailLayout(content, brand, shell);
    const dark = forceDarkPreview(html);
    expect(dark).toMatch(/<style>\.kc-page\{background-color:#09090b !important\}[\s\S]*<\/style>\n<\/head>/);
  });

  it("escapes values in the shell (subject, eyebrow, brand)", () => {
    const html = renderEmailShell(
      { subject: "<script>x</script>", preheader: "p", bodyHtml: "", eyebrow: '<b onclick="x">' },
      { ...brand, companyName: "<img src=x onerror=alert(1)>", siteUrl: "javascript:alert(1)" },
      shell
    );
    expect(html).not.toContain("<script>x</script>");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain('<b onclick="x">');
    expect(html).not.toContain('href="javascript:');
  });
});

describe("every template", () => {
  const PAYLOAD = `<img src=x onerror=alert(1)><script>alert("x")</script>"'`;

  /** Sample data with every string replaced by the payload where the schema still accepts it. */
  function hostileData(template: ReturnType<typeof listTemplates>[number]) {
    const data: Record<string, unknown> = { ...(template.sample as Record<string, unknown>) };
    for (const [key, value] of Object.entries(data)) {
      // Broadcast bodies are staff HTML, sanitised before they reach the template.
      if (key === "bodyHtml") continue;
      const candidate = typeof value === "string" ? PAYLOAD : Array.isArray(value) && typeof value[0] === "string" ? [PAYLOAD] : null;
      if (candidate === null) continue;
      const next = { ...data, [key]: candidate };
      if (template.schema.safeParse(next).success) Object.assign(data, next);
    }
    return { ...data, recipientName: PAYLOAD };
  }

  it.each(listTemplates().map((template) => [template.key, template] as const))(
    "%s escapes user-provided values and has a plain-text part",
    (_key, template) => {
      const rendered = renderNotification(template.key, hostileData(template), ctx);
      expect(rendered.html).not.toContain("<img src=x");
      expect(rendered.html).not.toContain("<script>");
      expect(rendered.text.length).toBeGreaterThan(20);
      expect(rendered.text).not.toMatch(/<\/?(p|table|td|a|div)\b/);
      expect(rendered.text).toContain("KLEAWORK DIGITAL LLC");
      expect(rendered.preheader.trim().length).toBeGreaterThan(0);
    }
  );

  it("an admin override cannot inject markup through variables", () => {
    const rendered = renderNotification(
      "billing.invoice-created",
      { ...(listTemplates().find((t) => t.key === "billing.invoice-created")!.sample as object), recipientName: PAYLOAD },
      ctx,
      { override: { email: { subject: "Fatura", bodyHtml: "<p>Merhaba {{recipientName}}</p>", bodyText: "", version: 1 } } }
    );
    expect(rendered.html).toContain("<p>Merhaba &lt;img src=x");
    expect(rendered.html).not.toContain("<img src=x");
    expect(rendered.html).toContain('class="kc-card kc-pad kc-body"');
  });
});
