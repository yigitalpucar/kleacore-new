import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  let orderSeq = 0;
  const tx = {
    user: { findUnique: vi.fn() },
    domainTld: { findMany: vi.fn() },
    product: { findUnique: vi.fn(), findFirst: vi.fn() },
    order: {
      create: vi.fn(async () => {
        orderSeq += 1;
        return { id: `order_${orderSeq}` };
      }),
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.map((id) => ({ orderNumber: id.toUpperCase() }))
      ),
    },
    invoice: { create: vi.fn(async () => ({ id: `invoice_${orderSeq}` })) },
    payment: { create: vi.fn() },
    orderActivity: { create: vi.fn() },
    consentRecord: { createMany: vi.fn(async ({ data }: { data: unknown[] }) => ({ count: data.length })) },
  };
  return {
    tx,
    db: {
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
      domainTld: tx.domainTld,
    },
    auth: vi.fn(),
    getPurchaseBlock: vi.fn(),
    getCheckoutLegalDocuments: vi.fn(),
    getFraudConfig: vi.fn(),
    evaluateCheckoutOrders: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/events/emit", () => ({ emitEvent: vi.fn().mockResolvedValue({ id: "evt-1", queued: true }) }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/auth/email-verification", () => ({ getPurchaseBlock: mocks.getPurchaseBlock }));
vi.mock("@/lib/legal/documents", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/legal/documents")>()),
  getCheckoutLegalDocuments: mocks.getCheckoutLegalDocuments,
  getLegalSeller: vi.fn(async () => ({
    name: "KLEAWORK DIGITAL LLC",
    address: "30 N Gould St",
    email: "destek@kleacore.com",
    phone: "",
    taxId: "EIN",
    website: "https://kleacore.com",
  })),
  getLegalBuyer: vi.fn(async () => ({ name: "Ada Lovelace", email: "ada@example.com", phone: "", address: "" })),
}));
vi.mock("@/lib/request-meta", () => ({
  getRequestMeta: vi.fn(async () => ({ ip: "203.0.113.5", userAgent: "vitest-browser", country: "DE", countrySource: "cf-header" })),
}));
vi.mock("@/lib/utils/number-generators", () => ({
  generateOrderNumber: vi.fn(async () => "ORD"),
  generateInvoiceNumber: vi.fn(async () => "INV"),
}));
vi.mock("@/lib/provisioning/internal", () => ({ provisionCompletedOrder: vi.fn() }));
vi.mock("@/lib/notifications/email", () => ({
  dispatchNotification: vi.fn(),
  loadCustomerRecipient: vi.fn(),
  sendOrderConfirmationEmail: vi.fn(),
}));
vi.mock("@/lib/affiliate", () => ({ applyAffiliateCommission: vi.fn() }));
vi.mock("@/lib/reseller", () => ({
  applyResellerDiscount: vi.fn(),
  getResellerDiscountForCustomer: vi.fn(async () => null),
}));
vi.mock("@/lib/stripe", () => ({ getAppBaseUrl: () => "http://localhost", getStripe: vi.fn() }));
vi.mock("@/lib/integrations/payment-gateways/persist", () => ({ persistGatewayCheckout: vi.fn() }));
vi.mock("@/lib/integrations/payment-gateways", () => ({ getPaymentGatewayProvider: vi.fn() }));
vi.mock("@/lib/payments/orchestrator", () => ({ loadCheckoutCustomer: vi.fn() }));
vi.mock("@/lib/payments/payment-options", () => ({
  resolveCustomerPaymentMethod: vi.fn(async (id: string) => ({ id, cardGateway: null })),
}));
vi.mock("@/lib/payments/balance-payment", () => ({
  payInvoicesWithBalance: vi.fn(),
  balancePaymentErrorMessage: vi.fn(),
}));
vi.mock("@/lib/billing/promo-usage", () => ({ claimPromotionUse: vi.fn() }));
vi.mock("@/lib/products/configurator", () => ({
  calculateConfigurationPrice: vi.fn(),
  validateConfigurationSelections: vi.fn(),
}));
vi.mock("@/lib/billing/tax", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/billing/tax")>()),
  getTaxRate: vi.fn(async () => 20),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/fraud/settings", () => ({ getFraudConfig: mocks.getFraudConfig }));
vi.mock("@/lib/fraud/evaluate", () => ({ evaluateCheckoutOrders: mocks.evaluateCheckoutOrders }));
vi.mock("@/lib/payments/follow-ups", () => ({
  withSavepoint: async (_tx: unknown, fn: () => Promise<unknown>) => ({ ok: true, value: await fn() }),
}));

import { checkoutCart } from "./checkout";

const legalDocuments = [
  {
    id: "doc_pre",
    type: "PRELIMINARY_INFORMATION",
    version: 1,
    title: "Ön Bilgilendirme Formu",
    content: "<p>{{buyer.name}} {{order.total}}</p>{{order.items_table}}",
    isPlaceholder: true,
    publishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "doc_dsc",
    type: "DISTANCE_SALES_CONTRACT",
    version: 2,
    title: "Mesafeli Satış Sözleşmesi",
    content: "<p>{{order.numbers}} {{order.payment_method}}</p>",
    isPlaceholder: true,
    publishedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const consents = [
  { documentId: "doc_pre", version: 1 },
  { documentId: "doc_dsc", version: 2 },
];

const cart = {
  paymentMethod: "bank_transfer" as const,
  items: [
    { id: "domain:ornek.com", type: "domain" as const, quantity: 1, metadata: { domain: "ornek.com" } },
    { id: "domain:deneme.com", type: "domain" as const, quantity: 1, metadata: { domain: "deneme.com" } },
  ],
};

describe("checkoutCart signup guards", () => {
  beforeEach(() => {
    mocks.auth.mockResolvedValue({ user: { id: "user_1" } });
    mocks.getPurchaseBlock.mockResolvedValue(null);
    mocks.getCheckoutLegalDocuments.mockResolvedValue(legalDocuments);
    mocks.getFraudConfig.mockResolvedValue({ enabled: false, trustCfHeader: true });
    mocks.evaluateCheckoutOrders.mockResolvedValue([]);
    mocks.tx.user.findUnique.mockResolvedValue({ balance: 0 });
    mocks.tx.domainTld.findMany.mockResolvedValue([
      { ext: ".com", registerPrice: 100, renewPrice: 120, isActive: true },
    ]);
    mocks.tx.product.findUnique.mockResolvedValue({
      id: "prod_domain",
      sku: "DOM-COM",
      name: ".com",
      category: { slug: "domain" },
      pricingTiers: [],
    });
  });

  it("blocks checkout for an unverified e-mail before touching the database", async () => {
    mocks.getPurchaseBlock.mockResolvedValue({
      success: false,
      error: "doğrulayın",
      code: "EMAIL_NOT_VERIFIED",
    });

    const result = await checkoutCart({ ...cart, consents });

    expect(result).toMatchObject({ success: false, code: "EMAIL_NOT_VERIFIED" });
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
    expect(mocks.tx.order.create).not.toHaveBeenCalled();
  });

  it("refuses to create orders without the legal consents", async () => {
    const result = await checkoutCart(cart);

    expect(result).toMatchObject({ success: false, code: "LEGAL_CONSENT_REQUIRED" });
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });

  it("refuses consent given to an outdated document version", async () => {
    const result = await checkoutCart({
      ...cart,
      consents: [
        { documentId: "doc_pre", version: 1 },
        { documentId: "doc_dsc", version: 1 },
      ],
    });

    expect(result).toMatchObject({ success: false, code: "LEGAL_CONSENT_OUTDATED" });
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });

  it("stores exactly one consent record per order and document, inside the order transaction", async () => {
    const result = await checkoutCart({ ...cart, consents });

    expect(result.success).toBe(true);
    expect(mocks.tx.order.create).toHaveBeenCalledTimes(2);
    expect(mocks.tx.consentRecord.createMany).toHaveBeenCalledOnce();
    // OrderItem amounts are net (KDV only on the order): 100, not 120.
    const orderData = (mocks.tx.order.create.mock.calls as unknown as Array<[{ data: Record<string, any> }]>)[0][0].data;
    expect(String(orderData.items.create.totalPrice)).toBe("100");
    expect(String(orderData.totalAmount)).toBe("120");

    const { data, skipDuplicates } = mocks.tx.consentRecord.createMany.mock.calls[0][0] as {
      data: Array<Record<string, unknown>>;
      skipDuplicates: boolean;
    };
    expect(skipDuplicates).toBe(true);
    const orderIds = mocks.tx.order.create.mock.results.map((r) => (r.value as Promise<{ id: string }>));
    const ids = (await Promise.all(orderIds)).map((order) => order.id);
    expect(data.map((row) => `${row.orderId}:${row.documentId}`).sort()).toEqual(
      ids.flatMap((id) => [`${id}:doc_dsc`, `${id}:doc_pre`]).sort()
    );
    for (const row of data) {
      expect(row).toMatchObject({ userId: "user_1", ipAddress: "203.0.113.5", userAgent: "vitest-browser" });
    }

    // The snapshot carries the server-side totals: 2 × (100 + 20% KDV).
    const preliminary = data.find((row) => row.documentId === "doc_pre");
    expect(preliminary?.snapshot).toContain("Ada Lovelace 240,00 TL");
    expect(preliminary?.snapshot).toContain("ornek.com Domain Kaydı");
    const contract = data.find((row) => row.documentId === "doc_dsc");
    expect(contract?.snapshot).toContain(ids.map((id) => id.toUpperCase()).join(", "));
    expect(contract?.snapshot).toContain("Banka havalesi");
  });

  it("scores every order of the checkout inside the transaction (IP + CF country)", async () => {
    mocks.getFraudConfig.mockResolvedValue({ enabled: true, trustCfHeader: true });
    mocks.evaluateCheckoutOrders.mockResolvedValue([
      { orderId: "order_x", score: 10, status: "PASSED", paymentBlocked: false },
    ]);

    const result = await checkoutCart({ ...cart, consents });

    expect(result.success).toBe(true);
    expect(mocks.evaluateCheckoutOrders).toHaveBeenCalledOnce();
    const [client, input] = mocks.evaluateCheckoutOrders.mock.calls[0] as [unknown, Record<string, any>];
    expect(client).toBe(mocks.tx);
    expect(input).toMatchObject({ customerId: "user_1", ipAddress: "203.0.113.5", ipCountry: "DE", ipCountrySource: "cf-header" });
    expect(input.orders).toHaveLength(2);
    expect(input.orders[0]).toMatchObject({ categorySlug: "domain" });
    expect(result.success && result.data).toMatchObject({ reviewRequired: false, paymentBlocked: false });
  });

  it("opens no payment when the score is over the block threshold", async () => {
    const { payInvoicesWithBalance } = await import("@/lib/payments/balance-payment");
    mocks.getFraudConfig.mockResolvedValue({ enabled: true, trustCfHeader: false });
    mocks.evaluateCheckoutOrders.mockResolvedValue([
      { orderId: "order_x", score: 90, status: "REVIEW", paymentBlocked: true },
    ]);
    mocks.tx.user.findUnique.mockResolvedValue({ balance: 1000 });

    const result = await checkoutCart({ ...cart, paymentMethod: "balance", consents });

    expect(result.success).toBe(true);
    expect(result.success && result.data).toMatchObject({ reviewRequired: true, paymentBlocked: true, paidWithBalance: false });
    expect(payInvoicesWithBalance).not.toHaveBeenCalled();
  });

  it("skips the risk evaluation when it is switched off", async () => {
    const result = await checkoutCart({ ...cart, consents });
    expect(result.success).toBe(true);
    expect(mocks.evaluateCheckoutOrders).not.toHaveBeenCalled();
  });
});
