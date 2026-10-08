import { describe, expect, it, vi } from "vitest";

const settingRows = vi.hoisted(() => ({ rows: [] as Array<{ key: string; value: string }> }));
vi.mock("@/lib/db", () => ({ db: { setting: { findMany: async () => settingRows.rows } } }));

import { DEFAULT_BRAND, loadBrand, renderNotification } from "./render";
import { listTemplates } from "./templates";
import type { RenderContext } from "./templates/types";

const ctx: RenderContext = {
  brand: {
    ...DEFAULT_BRAND,
    companyName: "KLEAWORK DIGITAL LLC",
    companyAddress: "30 N Gould St Ste R, Sheridan, WY 82801, USA",
    supportEmail: "destek@kleacore.com",
  },
  baseUrl: "https://kleacore.com",
};

const REQUIRED_KEYS = [
  "auth.verify-email",
  "auth.password-reset",
  "auth.password-changed",
  "billing.order-received",
  "billing.payment-received",
  "billing.invoice-created",
  "billing.invoice-reminder",
  "billing.invoice-overdue",
  "billing.bank-transfer-approved",
  "billing.bank-transfer-rejected",
  "billing.refund-issued",
  "service.activated",
  "service.suspended",
  "service.unsuspended",
  "service.cancellation-received",
  "service.cancellation-approved",
  "domain.registered",
  "domain.renewed",
  "domain.expiry-notice",
  "support.ticket-replied",
  "admin.manual-provisioning",
  "admin.domain-renewal-failed",
];

describe("notification templates", () => {
  const templates = listTemplates();

  it("covers every notification the roadmap requires", () => {
    const keys = templates.map((template) => template.key);
    for (const key of REQUIRED_KEYS) expect(keys).toContain(key);
  });

  it.each(templates.map((template) => [template.key, template] as const))("%s renders its sample in the branded layout", (_key, template) => {
    const rendered = renderNotification(template.key, template.sample, ctx);

    expect(rendered.subject.length).toBeGreaterThan(5);
    expect(rendered.html).toContain('<html lang="tr">');
    expect(rendered.html).toContain('src="cid:kleacore-logo"');
    // Footer: company info + support address on every mail.
    expect(rendered.html).toContain("KLEAWORK DIGITAL LLC");
    expect(rendered.html).toContain("destek@kleacore.com");
    expect(rendered.text).toContain("KLEAWORK DIGITAL LLC");
    // No remote images / tracking pixels.
    expect(rendered.html).not.toMatch(/<img[^>]+src="https?:/i);
    expect(rendered.html).not.toMatch(/utm_|tracking|pixel/i);
    if (template.sms) expect(rendered.sms).toBeTruthy();
  });

  it("escapes data in the HTML part", () => {
    const rendered = renderNotification(
      "support.ticket-replied",
      {
        recipientName: "<b>Ayşe</b>",
        ticketId: "t1",
        ticketNumber: "T-1",
        ticketSubject: "Test",
        senderName: "Destek",
        messagePreview: '<script>alert("x")</script>',
      },
      ctx
    );
    expect(rendered.html).not.toContain("<script>");
    expect(rendered.html).toContain("&lt;script&gt;");
    expect(rendered.html).toContain("Merhaba &lt;b&gt;Ayşe&lt;/b&gt;,");
  });

  it("never puts the password into the mail when it is delivered separately", () => {
    const rendered = renderNotification(
      "service.activated",
      {
        serviceId: "s1",
        serviceLabel: "VDS",
        kind: "server",
        ipAddress: "203.0.113.10",
        password: "GizliSifre!1",
        passwordDelivery: "separately",
      },
      ctx
    );
    expect(rendered.html).not.toContain("GizliSifre!1");
    expect(rendered.text).not.toContain("GizliSifre!1");
    expect(rendered.text).toContain("ayrıca iletilecektir");
  });

  it("automated VDS activation points to the one-time password reveal in the panel", () => {
    const rendered = renderNotification(
      "service.activated",
      { serviceId: "s1", serviceLabel: "VDS", kind: "server", ipAddress: "203.0.113.20", username: "kleacore", passwordDelivery: "panel" },
      ctx
    );
    expect(rendered.text).toContain("IP adresi: 203.0.113.20");
    expect(rendered.text).toContain("hizmet sayfasından bir kez görüntüleyebilirsiniz");
  });

  it("hosting activation lists cPanel user, panel URL and nameservers", () => {
    const rendered = renderNotification(
      "service.activated",
      {
        serviceId: "s1",
        serviceLabel: "Linux Hosting — ornek.com",
        kind: "hosting",
        username: "ornekcom",
        panelUrl: "https://srv1.kleacore.com:2083",
        nameservers: ["ns1.kleacore.com", "ns2.kleacore.com"],
        passwordDelivery: "panel",
      },
      ctx
    );
    expect(rendered.text).toContain("cPanel kullanıcı adı: ornekcom");
    expect(rendered.text).toContain("Kontrol paneli: https://srv1.kleacore.com:2083");
    expect(rendered.text).toContain("Ad sunucusu 2: ns2.kleacore.com");
  });

  it("domain expiry notice switches to the expired copy at daysLeft <= 0", () => {
    const base = { domain: "ornek.com", renewUrl: "https://kleacore.com/musteri/panel/domainler" };
    expect(renderNotification("domain.expiry-notice", { ...base, daysLeft: 7 }, ctx).subject).toContain("7 gün kaldı");
    expect(renderNotification("domain.expiry-notice", { ...base, daysLeft: 0 }, ctx).subject).toContain("süresi doldu");
  });

  it("rejects data that doesn't match the template schema", () => {
    expect(() => renderNotification("auth.verify-email", { verifyUrl: "not a url" }, ctx)).toThrow();
    expect(() => renderNotification("unknown.template", {}, ctx)).toThrow(/Unknown notification template/);
  });

  it("formats money and dates in Turkish", () => {
    const rendered = renderNotification(
      "billing.invoice-created",
      { invoiceId: "i1", invoiceNumber: "F-1", totalAmount: "1199.9", dueDate: "2026-10-15T09:00:00.000Z" },
      ctx
    );
    expect(rendered.text).toMatch(/1\.199,90\s₺/);
    expect(rendered.text).toContain("15.10.2026");
  });
});

describe("e-mail footer company block", () => {
  it("drops the placeholder phone/address and uses the site-footer company", async () => {
    settingRows.rows = [
      { key: "company_name", value: "KLEAWORK DIGITAL LLC" },
      { key: "company_phone", value: "+90 850 000 00 00" },
      { key: "company_address", value: "İstanbul, Türkiye" },
      { key: "support_email", value: "destek@kleacore.com" },
    ];
    const brand = await loadBrand();
    expect(brand).toMatchObject({
      companyName: "KLEAWORK DIGITAL LLC",
      companyAddress: "30 N Gould St Ste R, Sheridan, WY 82801, USA",
      companyPhone: "",
    });

    const rendered = await renderNotification(
      "billing.payment-received",
      { invoiceId: "inv-1", invoiceNumber: "F-1", paidAmount: 10, paidAt: new Date("2026-10-08") },
      { brand, baseUrl: "https://kleacore.com" }
    );
    expect(rendered.html).not.toContain("850 000 00 00");
    expect(rendered.html).not.toContain("İstanbul, Türkiye");
    expect(rendered.text).toContain("30 N Gould St Ste R");
  });
});
