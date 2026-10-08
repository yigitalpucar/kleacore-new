import { createHmac } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createWebhookSignature,
  dispatchOutboundWebhook,
} from "./outbound";

vi.mock("@/lib/integrations/settings", () => ({
  getSettingMap: vi.fn(),
}));

import { getSettingMap } from "@/lib/integrations/settings";

const mockedGetSettingMap = vi.mocked(getSettingMap);

describe("createWebhookSignature", () => {
  it("generates HMAC-SHA256 hex signature for the request body", () => {
    const body = JSON.stringify({
      type: "payment.completed",
      payload: { invoiceId: "inv-1" },
    });
    const secret = "test-signing-secret";

    const expected = createHmac("sha256", secret).update(body).digest("hex");

    expect(createWebhookSignature(body, secret)).toBe(expected);
  });
});

describe("dispatchOutboundWebhook", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
    });
    vi.stubGlobal("fetch", fetchMock);
    process.env.WEBHOOK_SIGNING_SECRET = "webhook-secret";
    delete process.env.CRON_SECRET;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.WEBHOOK_SIGNING_SECRET;
    delete process.env.CRON_SECRET;
  });

  it("posts payment.completed to webhook_payments with signature header", async () => {
    mockedGetSettingMap.mockResolvedValue({
      webhook_orders: "https://example.com/orders",
      webhook_payments: "https://example.com/payments",
    });

    const payload = {
      invoiceId: "inv-1",
      invoiceNumber: "F-2026-0001",
      customerId: "cust-1",
      amount: 199.99,
      paymentReference: "pi_123",
      context: "order" as const,
    };

    await dispatchOutboundWebhook("payment.completed", payload);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = options.body as string;

    expect(url).toBe("https://example.com/payments");
    expect(options.method).toBe("POST");
    expect(options.headers).toMatchObject({
      "content-type": "application/json",
      "X-Kleacore-Signature": createWebhookSignature(body, "webhook-secret"),
    });
    expect(JSON.parse(body)).toMatchObject({
      type: "payment.completed",
      payload,
    });
  });

  it("posts order.paid to webhook_orders URL", async () => {
    mockedGetSettingMap.mockResolvedValue({
      webhook_orders: "https://example.com/orders",
      webhook_payments: "https://example.com/payments",
    });

    await dispatchOutboundWebhook("order.paid", {
      orderId: "ord-1",
      orderNumber: "S-2026-00001",
      customerId: "cust-1",
      totalAmount: 299.99,
    });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.com/orders");
  });

  it("posts service.renewed to webhook_payments URL", async () => {
    mockedGetSettingMap.mockResolvedValue({
      webhook_orders: "https://example.com/orders",
      webhook_payments: "https://example.com/payments",
    });

    await dispatchOutboundWebhook("service.renewed", {
      serviceId: "svc-1",
      customerId: "cust-1",
      newExpiryDate: "2027-06-17T00:00:00.000Z",
      renewalMonths: 12,
    });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.com/payments");
  });

  it("skips dispatch when target webhook URL is not configured", async () => {
    mockedGetSettingMap.mockResolvedValue({
      webhook_orders: "",
      webhook_payments: "",
    });

    await dispatchOutboundWebhook("payment.completed", {
      invoiceId: "inv-1",
      invoiceNumber: "F-2026-0001",
      customerId: "cust-1",
      amount: 100,
      context: "invoice",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips dispatch when WEBHOOK_SIGNING_SECRET is missing", async () => {
    delete process.env.WEBHOOK_SIGNING_SECRET;
    process.env.CRON_SECRET = "cron-secret";

    mockedGetSettingMap.mockResolvedValue({
      webhook_orders: "",
      webhook_payments: "https://example.com/payments",
    });

    await dispatchOutboundWebhook("payment.completed", {
      invoiceId: "inv-2",
      invoiceNumber: "F-2026-0002",
      customerId: "cust-2",
      amount: 50,
      context: "invoice",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws when fetch fails so the event delivery is retried", async () => {
    mockedGetSettingMap.mockResolvedValue({
      webhook_orders: "",
      webhook_payments: "https://example.com/payments",
    });
    fetchMock.mockRejectedValue(new Error("network down"));

    await expect(
      dispatchOutboundWebhook("payment.completed", {
        invoiceId: "inv-3",
        invoiceNumber: "F-2026-0003",
        customerId: "cust-3",
        amount: 75,
        context: "invoice",
      })
    ).rejects.toThrow("network down");
  });

  it("throws on a non-2xx answer", async () => {
    mockedGetSettingMap.mockResolvedValue({ webhook_orders: "https://example.com/orders", webhook_payments: "" });
    fetchMock.mockResolvedValue({ ok: false, status: 502 });

    await expect(
      dispatchOutboundWebhook("order.paid", { orderId: "o", orderNumber: "S-1", customerId: "c", totalAmount: 1 })
    ).rejects.toThrow("WEBHOOK_HTTP_502");
  });
});
