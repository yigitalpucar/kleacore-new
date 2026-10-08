import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/dal/settings", () => ({ getSettingByKey: vi.fn().mockResolvedValue(null) }));

import {
  TURNSTILE_TEST_KEYS,
  TURNSTILE_VERIFY_URL,
  getTurnstileKeys,
  verifyTurnstileToken,
} from "./turnstile";

const keys = {
  siteKey: TURNSTILE_TEST_KEYS.siteKeyAlwaysPasses,
  secretKey: TURNSTILE_TEST_KEYS.secretAlwaysPasses,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("verifyTurnstileToken", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts a token Cloudflare reports as valid and posts secret, token and IP", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ success: true, action: "register" }));

    const result = await verifyTurnstileToken("tok-123", {
      keys,
      fetchImpl,
      remoteIp: "203.0.113.7",
      action: "register",
    });

    expect(result).toEqual({ success: true, bypassed: false });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(TURNSTILE_VERIFY_URL);
    const body = init.body as URLSearchParams;
    expect(body.get("secret")).toBe(keys.secretKey);
    expect(body.get("response")).toBe("tok-123");
    expect(body.get("remoteip")).toBe("203.0.113.7");
  });

  it("rejects a token Cloudflare reports as invalid", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(jsonResponse({ success: false, "error-codes": ["invalid-input-response"] }));

    const result = await verifyTurnstileToken("bad", { keys, fetchImpl });

    expect(result).toEqual({
      success: false,
      reason: "invalid-token",
      errorCodes: ["invalid-input-response"],
    });
  });

  it("rejects a token minted for another form", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ success: true, action: "contact" }));

    const result = await verifyTurnstileToken("tok", { keys, fetchImpl, action: "register" });

    expect(result).toMatchObject({ success: false, reason: "action-mismatch" });
  });

  it("rejects an empty token without calling Cloudflare", async () => {
    const fetchImpl = vi.fn();

    const result = await verifyTurnstileToken("  ", { keys, fetchImpl });

    expect(result).toMatchObject({ success: false, reason: "missing-token" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails closed when siteverify does not answer in time", async () => {
    const fetchImpl = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        })
    );

    const result = await verifyTurnstileToken("tok", {
      keys,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      timeoutMs: 10,
    });

    expect(result).toMatchObject({ success: false, reason: "timeout" });
  });

  it("fails closed on network and HTTP errors", async () => {
    const network = await verifyTurnstileToken("tok", {
      keys,
      fetchImpl: vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    });
    expect(network).toMatchObject({ success: false, reason: "network-error" });

    const http = await verifyTurnstileToken("tok", {
      keys,
      fetchImpl: vi.fn().mockResolvedValue(new Response("oops", { status: 500 })),
    });
    expect(http).toMatchObject({ success: false, reason: "network-error" });
  });

  it("fails closed in production when the keys are missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const fetchImpl = vi.fn();

    const result = await verifyTurnstileToken("tok", {
      keys: { siteKey: null, secretKey: null },
      fetchImpl,
    });

    expect(result).toMatchObject({ success: false, reason: "misconfigured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("fails closed in production when only one key is set", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const result = await verifyTurnstileToken("tok", {
      keys: { siteKey: "site", secretKey: null },
      fetchImpl: vi.fn(),
    });

    expect(result).toMatchObject({ success: false, reason: "misconfigured" });
  });

  it("bypasses outside production when the keys are missing", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const fetchImpl = vi.fn();

    const result = await verifyTurnstileToken(undefined, {
      keys: { siteKey: null, secretKey: null },
      fetchImpl,
    });

    expect(result).toEqual({ success: true, bypassed: true });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("getTurnstileKeys", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers the environment", async () => {
    vi.stubEnv("TURNSTILE_SITE_KEY", " site ");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "secret");

    await expect(getTurnstileKeys()).resolves.toEqual({ siteKey: "site", secretKey: "secret" });
  });

  it("returns nulls when neither env nor settings carry keys", async () => {
    vi.stubEnv("TURNSTILE_SITE_KEY", "");
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");

    await expect(getTurnstileKeys()).resolves.toEqual({ siteKey: null, secretKey: null });
  });
});
