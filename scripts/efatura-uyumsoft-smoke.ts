/**
 * Uyumsoft TEST-environment smoke test (never production).
 *
 *   pnpm exec tsx scripts/efatura-uyumsoft-smoke.ts [--cancel] [--log out.txt] [--pdf out.pdf]
 *
 * Uses Uyumsoft's public test user (Uyumsoft / Uyumsoft, override with
 * UYUMSOFT_TEST_USERNAME / UYUMSOFT_TEST_PASSWORD) against
 * efatura-test.uyumsoft.com.tr: taxpayer check → issue a sample e-Arşiv →
 * status → PDF (→ cancel). Request/response bodies are logged with the
 * WS-Security credentials redacted.
 */
import { writeFileSync } from "fs";
import { buildEInvoiceDocument } from "../src/lib/integrations/efatura/builder";
import { createUyumsoftEInvoiceProvider } from "../src/lib/integrations/efatura/providers/uyumsoft";
import type { InvoiceForEInvoice, SupplierInfo } from "../src/lib/integrations/efatura/types";

const args = process.argv.slice(2);
const logPath = args.includes("--log") ? args[args.indexOf("--log") + 1] : null;
const pdfPath = args.includes("--pdf") ? args[args.indexOf("--pdf") + 1] : null;
const exchanges: string[] = [];

const provider = createUyumsoftEInvoiceProvider(
  {
    username: process.env.UYUMSOFT_TEST_USERNAME || "Uyumsoft",
    password: process.env.UYUMSOFT_TEST_PASSWORD || "Uyumsoft",
    testMode: true, // hard-wired: this script must never hit production
  },
  {
    onExchange: ({ action, request, response, status }) => {
      exchanges.push(`### ${action} (HTTP ${status})\n--> ${request}\n<-- ${response.replace(/<Data>[^<]{200,}<\/Data>/, "<Data>…base64 PDF…</Data>")}\n`);
    },
  }
);

// The test account's own company (WhoAmI on the test user).
const supplier: SupplierInfo = {
  name: "UYUMSOFT BİLGİ SİSTEMLERİ VE TEKNOLOJİLERİ TİCARET A.Ş.",
  vkn: "9000068418",
  taxOffice: "ESENLER",
  street: "Test Cad. No:1",
  district: "Esenler",
  city: "İstanbul",
  postalZone: "34000",
  country: "Türkiye",
  phone: "",
  email: "",
  website: "https://kleacore.com",
};

const now = new Date();
const invoice: InvoiceForEInvoice = {
  id: `smoke_${now.getTime()}`,
  invoiceNumber: `KC-SMOKE-${now.getTime()}`,
  customerId: "smoke",
  subtotal: 249.99,
  taxRate: 20,
  taxAmount: 50,
  totalAmount: 299.99,
  issuedAt: now,
  paidAt: now,
  items: [
    { id: "1", description: "Web Hosting Başlangıç - Yıllık", quantity: 1, unitPrice: 199.99, totalPrice: 239.99 },
    { id: "2", description: ".com.tr alan adı - 1 yıl", quantity: 1, unitPrice: 50, totalPrice: 60 },
  ],
  payments: [{ method: "CREDIT_CARD", status: "COMPLETED", paidAt: now }],
  customer: {
    name: "Test",
    surname: "Müşteri",
    email: "test@example.com",
    phone: null,
    customerType: "INDIVIDUAL",
    companyName: null,
    taxNumber: null,
    taxOffice: null,
    address: "Atatürk Cad. No:1",
    city: "İstanbul",
    country: "Türkiye",
  },
};

async function main() {
  console.log("health:", await provider.healthCheck());
  console.log("taxpayer 9000068418:", await provider.checkTaxpayer("9000068418"));
  console.log("taxpayer 11111111111:", await provider.checkTaxpayer("11111111111"));

  const doc = buildEInvoiceDocument(invoice, { supplier, type: "e-arsiv", now });
  const issued = await provider.issue(doc);
  console.log("issued:", issued);

  console.log("status:", await provider.getStatus(issued.uuid, "e-arsiv"));
  const pdf = await provider.getPdf(issued.uuid, "e-arsiv");
  console.log("pdf:", pdf.subarray(0, 8).toString(), `${pdf.length} bytes`);
  if (pdfPath) writeFileSync(pdfPath, pdf);

  if (args.includes("--cancel")) {
    // e-Arşiv can only be cancelled once Uyumsoft has processed it (Approved).
    for (let i = 0; i < 12; i += 1) {
      const status = await provider.getStatus(issued.uuid, "e-arsiv");
      if (status.providerStatus !== "Queued" && status.providerStatus !== "Processing") break;
      await new Promise((resolve) => setTimeout(resolve, 10_000));
    }
    await provider.cancel(issued.uuid, "Smoke test");
    console.log("cancelled; status:", await provider.getStatus(issued.uuid, "e-arsiv"));
  }
}

main()
  .catch((error) => {
    console.error("FAILED:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    if (logPath) writeFileSync(logPath, exchanges.join("\n"));
  });
