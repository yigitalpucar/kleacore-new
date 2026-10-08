import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it, vi } from "vitest";
import { buildEInvoiceDocument } from "../../builder";
import type { InvoiceForEInvoice, SupplierInfo } from "../../types";
import { createUyumsoftEInvoiceProvider, mapUyumsoftStatus } from "./index";
import { buildSendInvoiceBody, buildQueryOutboxStatusBody, buildCancelEArchiveBody } from "./requests";
import { UYUMSOFT_ENDPOINTS, UyumsoftError, buildSoapEnvelope, parseSoapResponse, redactEnvelope } from "./soap";

const fixture = (name: string) => readFileSync(join(__dirname, "__fixtures__", `${name}.xml`), "utf8");

const supplier: SupplierInfo = {
  name: "KLEAWORK Dijital A.Ş.",
  vkn: "1234567890",
  taxOffice: "Kadıköy",
  street: "Bağdat Cad.",
  district: "Kadıköy",
  city: "İstanbul",
  postalZone: "",
  country: "Türkiye",
  phone: "",
  email: "info@kleacore.com",
  website: "https://kleacore.com",
};

const invoice: InvoiceForEInvoice = {
  id: "inv_1",
  invoiceNumber: "F-1",
  customerId: "c1",
  subtotal: 100,
  taxRate: 20,
  taxAmount: 20,
  totalAmount: 120,
  issuedAt: new Date("2026-10-08T10:00:00Z"),
  paidAt: new Date("2026-10-08T10:00:00Z"),
  items: [{ id: "i", description: "Hosting", quantity: 1, unitPrice: 100, totalPrice: 100 }],
  payments: [{ method: "BANK_TRANSFER", status: "COMPLETED", paidAt: new Date("2026-10-08T10:00:00Z") }],
  customer: {
    name: "Ali",
    surname: "Yılmaz",
    email: "ali@example.com",
    phone: null,
    customerType: "INDIVIDUAL",
    companyName: null,
    taxNumber: null,
    taxOffice: null,
    address: null,
    city: null,
    country: "Türkiye",
  },
};

function fakeFetch(...responses: Array<{ body: string; status?: number }>) {
  const calls: Array<{ url: string; action: string; body: string }> = [];
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const headers = init?.headers as Record<string, string>;
    calls.push({ url: String(url), action: headers.SOAPAction, body: String(init?.body) });
    const next = responses.shift();
    if (!next) throw new Error("no more fake responses");
    return new Response(next.body, { status: next.status ?? 200 });
  });
  return { impl: impl as unknown as typeof fetch, calls };
}

const credentials = { username: "Uyumsoft", password: "s3cr<et", testMode: true };

describe("Uyumsoft SOAP envelope", () => {
  it("carries a WS-Security UsernameToken with escaped password and a 5-minute timestamp", () => {
    const xml = buildSoapEnvelope({
      username: "user&co",
      password: "p<w>",
      body: "<TestConnection/>",
      now: new Date("2026-10-08T12:00:00.000Z"),
    });
    expect(xml).toContain("<wsse:Username>user&amp;co</wsse:Username>");
    expect(xml).toContain("#PasswordText\">p&lt;w&gt;</wsse:Password>");
    expect(xml).toContain("<wsu:Created>2026-10-08T12:00:00.000Z</wsu:Created>");
    expect(xml).toContain("<wsu:Expires>2026-10-08T12:05:00.000Z</wsu:Expires>");
    expect(xml).toContain("<s:Body><TestConnection/></s:Body>");
    expect(redactEnvelope(xml)).not.toMatch(/user&amp;co|p&lt;w&gt;/);
  });

  it("builds SendInvoice with the UBL inside InvoiceInfo and e-Arşiv internet-sale info", () => {
    const doc = buildEInvoiceDocument(invoice, { supplier, type: "e-arsiv", uuid: "uuid-1" });
    const body = buildSendInvoiceBody(doc, new Date("2026-10-08T12:00:00.000Z"));

    expect(body.startsWith('<SendInvoice xmlns="http://tempuri.org/"><invoices><InvoiceInfo LocalDocumentId="inv_1">')).toBe(true);
    // Invoice inherits the tempuri namespace; UBL children are prefixed.
    expect(body).toContain(`<Invoice xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"`);
    expect(body).toContain('<TargetCustomer VknTckn="11111111111" Title="Ali Yılmaz"/>');
    expect(body).toContain('<EArchiveInvoiceInfo DeliveryType="Electronic"><InternetSalesInfo><WebAddress>https://kleacore.com</WebAddress><PaymentType>EFT/HAVALE</PaymentType><PaymentDate>2026-10-08T10:00:00.000Z</PaymentDate></InternetSalesInfo></EArchiveInvoiceInfo>');
    expect(body).toContain("<Scenario>eArchive</Scenario>");
    expect(body).toContain('<Mailing EnableNotification="true" To="ali@example.com">');
    // WSDL sequence: Invoice, TargetCustomer, EArchiveInvoiceInfo, Scenario, Notification, CreateDateUtc.
    const order = ["<Invoice", "<TargetCustomer", "<EArchiveInvoiceInfo", "<Scenario>", "<Notification>", "<CreateDateUtc>"].map(
      (tag) => body.indexOf(tag)
    );
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("addresses e-Fatura to the receiver alias with the eInvoice scenario", () => {
    const doc = buildEInvoiceDocument(
      { ...invoice, customer: { ...invoice.customer, taxNumber: "9000068418", companyName: "Uyumsoft" } },
      { supplier, type: "e-fatura", customerAlias: "urn:mail:defaultpk@test.com" }
    );
    const body = buildSendInvoiceBody(doc);
    expect(body).toContain('<TargetCustomer VknTckn="9000068418" Alias="urn:mail:defaultpk@test.com" Title="Uyumsoft"/>');
    expect(body).toContain("<Scenario>eInvoice</Scenario>");
    expect(body).not.toContain("EArchiveInvoiceInfo");
    expect(body).not.toContain("<Notification>");
  });

  it("builds status and cancel requests", () => {
    expect(buildQueryOutboxStatusBody(["a", "b"])).toBe(
      '<QueryOutboxInvoiceStatus xmlns="http://tempuri.org/"><invoiceIds><string>a</string><string>b</string></invoiceIds></QueryOutboxInvoiceStatus>'
    );
    expect(buildCancelEArchiveBody("u", new Date("2026-10-08T12:00:00.000Z"))).toBe(
      '<CancelEArchiveInvoice xmlns="http://tempuri.org/"><request InvoiceId="u" CancelDate="2026-10-08T12:00:00.000Z"/></CancelEArchiveInvoice>'
    );
  });
});

describe("Uyumsoft response parsing", () => {
  it("surfaces SOAP faults (e.g. wrong credentials) as UyumsoftError", () => {
    expect(() => parseSoapResponse(fixture("fault-auth"), "TestConnection")).toThrow(
      /UYUMSOFT_FAULT: Bu sisteme erişmek için gerekli yetkiniz yok/
    );
  });

  it("treats IsSucceded=false as an error with the service message", () => {
    expect(() => parseSoapResponse(fixture("send-invoice-failed"), "SendInvoice")).toThrow(
      "UYUMSOFT_SENDINVOICE_FAILED: Fatura bilgisi yok.EFT-TESTPORTAL"
    );
  });

  it("rejects non-XML and missing results", () => {
    expect(() => parseSoapResponse("<html>", "SendInvoice")).toThrow(UyumsoftError);
    expect(() => parseSoapResponse(fixture("test-connection"), "SendInvoice")).toThrow("UYUMSOFT_NO_RESULT");
  });

  it("maps Uyumsoft statuses", () => {
    expect(mapUyumsoftStatus("Approved")).toBe("ACCEPTED");
    expect(mapUyumsoftStatus("Queued")).toBe("SENT");
    expect(mapUyumsoftStatus("EArchivedCanceled")).toBe("CANCELLED");
    expect(mapUyumsoftStatus("Declined")).toBe("REJECTED");
    expect(mapUyumsoftStatus("Error")).toBe("FAILED");
  });
});

describe("Uyumsoft provider (recorded test-environment fixtures)", () => {
  it("issues an e-Arşiv and returns the entegratör number", async () => {
    const { impl, calls } = fakeFetch({ body: fixture("send-invoice-earsiv") });
    const provider = createUyumsoftEInvoiceProvider(credentials, { fetch: impl });
    const doc = buildEInvoiceDocument(invoice, { supplier, type: "e-arsiv", uuid: "7551d41f-589c-49af-8d18-d1d628db2d0e" });

    const result = await provider.issue(doc);

    expect(result).toMatchObject({
      uuid: "7551d41f-589c-49af-8d18-d1d628db2d0e",
      number: "BOX2026000001884",
      status: "SENT",
    });
    expect(calls[0].url).toBe(UYUMSOFT_ENDPOINTS.test);
    expect(calls[0].action).toBe('"http://tempuri.org/IIntegration/SendInvoice"');
  });

  it("uses the production endpoint when test mode is off", async () => {
    const { impl, calls } = fakeFetch({ body: fixture("test-connection") });
    const provider = createUyumsoftEInvoiceProvider({ ...credentials, testMode: false }, { fetch: impl });
    await provider.healthCheck().catch(() => undefined);
    expect(calls[0].url).toBe(UYUMSOFT_ENDPOINTS.production);
  });

  it("checks taxpayers and picks the urn:mail receiver alias", async () => {
    const { impl, calls } = fakeFetch(
      { body: fixture("is-einvoice-user-true") },
      { body: fixture("get-user-aliasses") },
      { body: fixture("is-einvoice-user-false") }
    );
    const provider = createUyumsoftEInvoiceProvider(credentials, { fetch: impl });

    await expect(provider.checkTaxpayer("9000068418")).resolves.toEqual({
      isEInvoiceUser: true,
      alias: "urn:mail:defaultpk@test.com",
      title: "Uyumsoft Bilgi Sistem.ve Tekno.Tic.A.Ş.",
    });
    await expect(provider.checkTaxpayer("11111111111")).resolves.toEqual({ isEInvoiceUser: false });
    expect(calls[0].body).toContain("<vknTckn>9000068418</vknTckn>");
  });

  it("queries statuses in batch, case-insensitively", async () => {
    const { impl } = fakeFetch({ body: fixture("query-outbox-status") });
    const provider = createUyumsoftEInvoiceProvider(credentials, { fetch: impl });
    const statuses = await provider.getStatuses([
      "31D1C3BD-FCA4-4A01-BDE7-DF26E22DF92C",
      "bc058af0-8d90-4e9d-953f-ea0616cbe340",
    ]);
    expect(statuses.get("31d1c3bd-fca4-4a01-bde7-df26e22df92c")).toMatchObject({ status: "ACCEPTED", providerStatus: "Approved" });
    expect(statuses.get("bc058af0-8d90-4e9d-953f-ea0616cbe340")).toMatchObject({ status: "CANCELLED" });
  });

  it("decodes the PDF", async () => {
    const { impl } = fakeFetch({ body: fixture("get-outbox-pdf") });
    const provider = createUyumsoftEInvoiceProvider(credentials, { fetch: impl });
    const pdf = await provider.getPdf("7551d41f-589c-49af-8d18-d1d628db2d0e", "e-arsiv");
    expect(pdf.subarray(0, 8).toString()).toBe("%PDF-1.4");
  });

  it("treats a refused cancel (Value=false) as an error", async () => {
    const { impl } = fakeFetch({ body: fixture("cancel-earchive-ok") }, { body: fixture("cancel-earchive-refused") });
    const provider = createUyumsoftEInvoiceProvider(credentials, { fetch: impl });
    await expect(provider.cancel("a", "Hatalı fatura")).resolves.toBeUndefined();
    await expect(provider.cancel("b", "Hatalı fatura")).rejects.toThrow(/UYUMSOFT_CANCEL_REFUSED: Faturanın durumu/);
  });

  it("reports auth failures from the health check without throwing", async () => {
    const { impl } = fakeFetch({ body: fixture("fault-auth"), status: 500 });
    const provider = createUyumsoftEInvoiceProvider(credentials, { fetch: impl });
    await expect(provider.healthCheck()).resolves.toMatchObject({ ok: false, error: expect.stringContaining("yetkiniz yok") });
  });
});
