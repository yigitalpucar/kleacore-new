import { describe, expect, it } from "vitest";
import { DEFAULT_BRAND, renderNotification } from "@/lib/notifications/render";
import { listUnsubscribeHeaders } from "@/lib/mail";
import { getTemplate } from "@/lib/notifications/templates";
import { buildRecipientView, renderBroadcastContent, validateBroadcastContent } from "./content";

const ctx = { brand: DEFAULT_BRAND, baseUrl: "https://kleacore.test" };
const user = { name: "Ayşe", surname: "Yılmaz", email: "ayse@example.com", companyName: null };

describe("broadcast content", () => {
  it("accepts the whitelisted variables only", () => {
    expect(validateBroadcastContent({ subject: "Bakım {{customer.name}}", bodyHtml: "<p>{{brand.siteName}} {{baseUrl}}</p>" })).toEqual([]);
    expect(
      validateBroadcastContent({ subject: "x", bodyHtml: "{{#customer.companyName}}<p>{{customer.companyName}}</p>{{/customer.companyName}}" })
    ).toEqual([]);
    const errors = validateBroadcastContent({ subject: "{{password}}", bodyHtml: "<p>{{{customer.name}}}</p>", smsText: "{{customer.balance}}" });
    expect(errors.map((error) => error.field)).toEqual(["subject", "bodyHtml", "smsText"]);
  });

  it("escapes values in HTML and strips scripts / javascript: links", () => {
    const rendered = renderBroadcastContent(
      {
        subject: "Merhaba {{customer.firstName}}",
        bodyHtml: '<p>{{customer.name}}</p><script>alert(1)</script><a href="javascript:alert(1)" onclick="x()">tıkla</a>',
        smsText: "Sayin {{customer.name}}, bakim 02:00'de.",
      },
      buildRecipientView({ ...user, name: "<b>Ayşe</b>" }, ctx)
    );
    expect(rendered.subject).toBe("Merhaba <b>Ayşe</b>");
    expect(rendered.bodyHtml).toContain("&lt;b&gt;Ayşe&lt;/b&gt; Yılmaz");
    expect(rendered.bodyHtml).not.toMatch(/<script|onclick|javascript:/i);
    expect(rendered.bodyText).toContain("<b>Ayşe</b> Yılmaz");
    expect(rendered.sms).toBe("Sayin <b>Ayşe</b> Yılmaz, bakim 02:00'de.");
  });

  it("marketing mail carries the unsubscribe link and RFC 8058 headers; service mail does not", () => {
    const marketing = getTemplate("broadcast.marketing");
    const data = marketing.schema.parse(marketing.sample);
    const html = renderNotification("broadcast.marketing", marketing.sample, ctx).html;
    expect(html).toContain("Kampanya e-postalarından çık");
    expect(html).toContain("https://kleacore.com/abonelik/iptal?t=ornek");
    expect(marketing.mailHeaders?.(data)).toEqual({ listUnsubscribe: "https://kleacore.com/abonelik/iptal?t=ornek" });
    expect(listUnsubscribeHeaders("https://x.test/u?t=1")).toEqual({
      "List-Unsubscribe": "<https://x.test/u?t=1>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });

    const service = getTemplate("broadcast.service");
    const serviceHtml = renderNotification("broadcast.service", service.sample, ctx).html;
    expect(serviceHtml).not.toContain("abonelik");
    expect(service.mailHeaders).toBeUndefined();
  });

  it("is hidden from the template editor", () => {
    expect(getTemplate("broadcast.service").editable).toBe(false);
    expect(getTemplate("broadcast.marketing").editable).toBe(false);
  });
});
