import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoiceFindUnique: vi.fn(),
  getPurchaseBlock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { invoice: { findUnique: mocks.invoiceFindUnique } } }));
vi.mock("@/lib/utils/auth-helpers", () => ({
  requireCustomer: vi.fn().mockResolvedValue({ user: { id: "user_1" } }),
}));
vi.mock("@/lib/auth/email-verification", () => ({ getPurchaseBlock: mocks.getPurchaseBlock }));
vi.mock("@/lib/payments/orchestrator", () => ({
  initiateCreditCardPayment: vi.fn(),
  isStripePaymentMethod: vi.fn(),
  roundMoney: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { payInvoice } from "./invoices";

describe("payInvoice", () => {
  it("is blocked until the customer's e-mail is verified", async () => {
    mocks.getPurchaseBlock.mockResolvedValue({ success: false, error: "doğrulayın", code: "EMAIL_NOT_VERIFIED" });

    const result = await payInvoice({ invoiceId: "inv_1", paymentMethod: "CREDIT_CARD" });

    expect(result).toMatchObject({ success: false, code: "EMAIL_NOT_VERIFIED" });
    expect(mocks.getPurchaseBlock).toHaveBeenCalledWith("user_1");
    expect(mocks.invoiceFindUnique).not.toHaveBeenCalled();
  });
});
