import { describe, expect, it } from "vitest";
import { CUSTOMER_STOPPED_REASON, customerStartBlockReason, isCustomerStopped } from "./server-power";

describe("customerStartBlockReason", () => {
  it("allows starting a server the customer stopped", () => {
    expect(customerStartBlockReason({ status: "SUSPENDED", suspendReason: CUSTOMER_STOPPED_REASON })).toBeNull();
  });

  it("blocks servers suspended for non-payment or by an admin", () => {
    expect(customerStartBlockReason({ status: "SUSPENDED", suspendReason: "Vadesi geçmiş fatura" })).not.toBeNull();
    expect(customerStartBlockReason({ status: "SUSPENDED", suspendReason: null })).not.toBeNull();
  });

  it("blocks expired, cancelled and already running servers", () => {
    expect(customerStartBlockReason({ status: "EXPIRED" })).not.toBeNull();
    expect(customerStartBlockReason({ status: "CANCELLED" })).not.toBeNull();
    expect(customerStartBlockReason({ status: "ACTIVE" })).not.toBeNull();
  });
});

describe("isCustomerStopped", () => {
  it("is only true for SUSPENDED with the customer marker", () => {
    expect(isCustomerStopped({ status: "SUSPENDED", suspendReason: CUSTOMER_STOPPED_REASON })).toBe(true);
    expect(isCustomerStopped({ status: "EXPIRED", suspendReason: CUSTOMER_STOPPED_REASON })).toBe(false);
  });
});
