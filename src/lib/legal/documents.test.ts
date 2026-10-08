import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import type { LegalDocument } from "@prisma/client";
import { DEFAULT_LEGAL_DOCUMENTS } from "./defaults";
import { assertCheckoutConsents, hashLegalSnapshot, recordCheckoutConsents } from "./documents";
import { renderLegalTemplate, type LegalRenderContext } from "./render";

const context: LegalRenderContext = {
  seller: {
    name: "KLEAWORK DIGITAL LLC",
    address: "30 N Gould St",
    email: "destek@kleacore.com",
    phone: "",
    taxId: "EIN 36-5157418",
    website: "https://kleacore.com",
  },
  buyer: { name: "Ada <script>alert(1)</script>", email: "ada@example.com", phone: "", address: "" },
  order: {
    date: "8 Ekim 2026",
    numbers: "ORD-1, ORD-2",
    items: [
      { name: "ornek.com Domain Kaydı", quantity: 1, period: "Yıllık", lineTotal: 100 },
      { name: "Linux Hosting <b>", quantity: 1, period: "Aylık", lineTotal: 50.5 },
    ],
    subtotal: 150.5,
    discount: 10,
    taxRate: 20,
    tax: 28.1,
    total: 168.6,
    paymentMethod: "Banka havalesi / EFT",
  },
};

function doc(overrides: Partial<LegalDocument>): LegalDocument {
  return {
    id: "doc",
    type: "DISTANCE_SALES_CONTRACT",
    version: 1,
    title: "Mesafeli Satış Sözleşmesi",
    content: "<p>{{buyer.name}}</p>{{order.items_table}}<p>{{order.total}}</p>",
    isPlaceholder: true,
    publishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("renderLegalTemplate", () => {
  it("fills order variables, escapes values and builds the items table", () => {
    const html = renderLegalTemplate(DEFAULT_LEGAL_DOCUMENTS.DISTANCE_SALES_CONTRACT.content, context);

    expect(html).toContain("KLEAWORK DIGITAL LLC");
    expect(html).toContain("ORD-1, ORD-2");
    expect(html).toContain("168,60 TL");
    expect(html).toContain("ornek.com Domain Kaydı");
    expect(html).toContain("−10,00 TL");
    expect(html).toContain("Ada &lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("Linux Hosting &lt;b&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toMatch(/\{\{/);
  });

  it("renders every default checkout document without leftover variables", () => {
    for (const type of ["PRELIMINARY_INFORMATION", "DISTANCE_SALES_CONTRACT"] as const) {
      const html = renderLegalTemplate(DEFAULT_LEGAL_DOCUMENTS[type].content, context);
      expect(html, type).not.toMatch(/\{\{/);
      expect(html, type).toContain("cayma");
    }
  });
});

describe("assertCheckoutConsents", () => {
  const documents = [doc({ id: "pre", version: 1 }), doc({ id: "dsc", version: 2 })];

  it("accepts exactly the current versions", () => {
    expect(() =>
      assertCheckoutConsents(documents, [
        { documentId: "pre", version: 1 },
        { documentId: "dsc", version: 2 },
      ])
    ).not.toThrow();
  });

  it("rejects missing consents", () => {
    expect(() => assertCheckoutConsents(documents, undefined)).toThrow("LEGAL_CONSENT_MISSING");
    expect(() => assertCheckoutConsents(documents, [{ documentId: "pre", version: 1 }])).toThrow(
      "LEGAL_CONSENT_MISSING"
    );
  });

  it("rejects consent to an outdated version", () => {
    expect(() =>
      assertCheckoutConsents(documents, [
        { documentId: "pre", version: 1 },
        { documentId: "dsc", version: 1 },
      ])
    ).toThrow("LEGAL_CONSENT_OUTDATED");
  });
});

describe("recordCheckoutConsents", () => {
  it("creates one record per order and document with the rendered snapshot and its hash", async () => {
    const createMany = vi.fn().mockResolvedValue({ count: 4 });
    const tx = { consentRecord: { createMany } } as never;
    const documents = [
      doc({ id: "pre", type: "PRELIMINARY_INFORMATION", version: 1 }),
      doc({ id: "dsc", type: "DISTANCE_SALES_CONTRACT", version: 3 }),
    ];

    await recordCheckoutConsents(tx, {
      userId: "user_1",
      orderIds: ["order_1", "order_2"],
      documents,
      ...context,
      ipAddress: "203.0.113.9",
      userAgent: "vitest",
    });

    expect(createMany).toHaveBeenCalledOnce();
    const { data, skipDuplicates } = createMany.mock.calls[0][0];
    expect(skipDuplicates).toBe(true);
    expect(data).toHaveLength(4);
    expect(new Set(data.map((row: { orderId: string; documentId: string }) => `${row.orderId}:${row.documentId}`)).size).toBe(4);
    for (const row of data) {
      expect(row).toMatchObject({ userId: "user_1", ipAddress: "203.0.113.9", userAgent: "vitest" });
      expect(row.snapshotHash).toBe(hashLegalSnapshot(row.snapshot));
      expect(row.snapshot).toContain("168,60 TL");
    }
    expect(data.find((row: { documentId: string }) => row.documentId === "dsc")).toMatchObject({
      documentType: "DISTANCE_SALES_CONTRACT",
      documentVersion: 3,
    });
  });
});
