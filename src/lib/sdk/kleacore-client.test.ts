import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KleacoreApiError, KleacoreClient } from "./kleacore-client";

describe("KleacoreClient", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: { invoices: [], pagination: { total: 0, page: 1, perPage: 10, totalPages: 0 } },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends Bearer auth header on requests", async () => {
    const client = new KleacoreClient("kc_live_test_key", "https://example.com/api/v1");
    await client.listInvoices();

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/api/v1/invoices",
      expect.objectContaining({
        headers: expect.any(Headers),
      })
    );

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer kc_live_test_key");
  });

  it("builds query strings for list endpoints", async () => {
    const client = new KleacoreClient("kc_live_test_key", "https://example.com/api/v1");
    await client.listServices({ page: 2, perPage: 25, status: "ACTIVE", category: "hosting" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/api/v1/services?page=2&perPage=25&status=ACTIVE&category=hosting",
      expect.any(Object)
    );
  });

  it("encodes path parameters for detail endpoints", async () => {
    const client = new KleacoreClient("kc_live_test_key", "https://example.com/api/v1");
    await client.getDomain("example.com");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/api/v1/domains/example.com",
      expect.any(Object)
    );
  });

  it("sends JSON body for createTicket", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        success: true,
        data: { ticket: { id: "tkt-1" } },
      }),
    });

    const client = new KleacoreClient("kc_live_test_key", "https://example.com/api/v1");
    await client.createTicket({
      subject: "API test",
      message: "Hello from SDK",
      department: "TECHNICAL",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/api/v1/tickets",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          subject: "API test",
          message: "Hello from SDK",
          department: "TECHNICAL",
        }),
      })
    );

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Headers;
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("throws KleacoreApiError when API returns an error envelope", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        success: false,
        error: "Geçersiz veya eksik API anahtarı",
      }),
    });

    const client = new KleacoreClient("bad_key");

    await expect(client.listOrders()).rejects.toMatchObject({
      name: "KleacoreApiError",
      message: "Geçersiz veya eksik API anahtarı",
      status: 401,
    } satisfies Partial<KleacoreApiError>);
  });

  it("strips trailing slash from base URL", async () => {
    const client = new KleacoreClient("kc_live_test_key", "https://example.com/api/v1/");
    await client.getInvoice("inv-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/api/v1/invoices/inv-1",
      expect.any(Object)
    );
  });
});