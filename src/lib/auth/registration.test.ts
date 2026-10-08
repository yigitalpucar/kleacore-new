import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const tx = { consentRecord: { create: vi.fn() } };
  return {
    tx,
    db: { $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) },
    createCustomerUser: vi.fn(),
    findUserByEmail: vi.fn(),
    sendVerificationEmail: vi.fn(),
    verifyTurnstileToken: vi.fn(),
    getCurrentLegalDocument: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/events/emit", () => ({ emitEvent: vi.fn().mockResolvedValue({ id: "evt-1", queued: true }) }));
vi.mock("@/lib/affiliate", () => ({ createCustomerUser: mocks.createCustomerUser }));
vi.mock("@/lib/auth/email", () => ({ findUserByEmail: mocks.findUserByEmail }));
vi.mock("@/lib/auth/email-verification", () => ({ sendVerificationEmail: mocks.sendVerificationEmail }));
vi.mock("@/lib/security/turnstile", () => ({
  TURNSTILE_ERROR_MESSAGE: "captcha",
  verifyTurnstileToken: mocks.verifyTurnstileToken,
}));
vi.mock("@/lib/legal/documents", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/legal/documents")>()),
  getCurrentLegalDocument: mocks.getCurrentLegalDocument,
}));

import { registerCustomerAccount, type RegisterCustomerInput } from "./registration";

const input: RegisterCustomerInput = {
  name: "Ada",
  surname: "Lovelace",
  email: "ada@example.com",
  password: "Test12345!",
  kvkkAccepted: true,
  turnstileToken: "tok",
  ipAddress: "203.0.113.1",
  userAgent: "vitest",
};

describe("registerCustomerAccount", () => {
  beforeEach(() => {
    mocks.verifyTurnstileToken.mockResolvedValue({ success: true, bypassed: false });
    mocks.findUserByEmail.mockResolvedValue(null);
    mocks.createCustomerUser.mockResolvedValue({ id: "user_new" });
    mocks.getCurrentLegalDocument.mockResolvedValue({
      id: "kvkk_1",
      type: "KVKK_NOTICE",
      version: 1,
      content: "<p>KVKK</p>",
    });
  });

  it("creates the account, records the KVKK acknowledgement and sends the verification mail", async () => {
    const result = await registerCustomerAccount(input);

    expect(result).toEqual({ success: true, userId: "user_new" });
    expect(mocks.verifyTurnstileToken).toHaveBeenCalledWith("tok", {
      remoteIp: "203.0.113.1",
      action: "register",
    });
    // No emailVerifiedAt is set: new accounts start unverified.
    expect(mocks.createCustomerUser.mock.calls[0][1]).not.toHaveProperty("emailVerifiedAt");
    expect(mocks.tx.consentRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user_new",
        documentId: "kvkk_1",
        documentType: "KVKK_NOTICE",
        documentVersion: 1,
        ipAddress: "203.0.113.1",
        userAgent: "vitest",
      }),
    });
    expect(mocks.sendVerificationEmail).toHaveBeenCalledWith("user_new");
  });

  it("requires the KVKK acknowledgement", async () => {
    const result = await registerCustomerAccount({ ...input, kvkkAccepted: false });

    expect(result).toMatchObject({ success: false, status: 400 });
    expect(mocks.createCustomerUser).not.toHaveBeenCalled();
  });

  it("rejects a failed Turnstile check before creating anything", async () => {
    mocks.verifyTurnstileToken.mockResolvedValue({ success: false, reason: "invalid-token", errorCodes: [] });

    const result = await registerCustomerAccount(input);

    expect(result).toMatchObject({ success: false, status: 403, error: "captcha" });
    expect(mocks.findUserByEmail).not.toHaveBeenCalled();
    expect(mocks.createCustomerUser).not.toHaveBeenCalled();
  });
});
