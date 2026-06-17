import { describe, expect, it } from "vitest";
import { isRenewalOrder } from "./renewal-fulfillment";

describe("isRenewalOrder", () => {
  it("returns true when serviceId and renewalMonths are present", () => {
    expect(
      isRenewalOrder({
        serviceId: "svc-1",
        items: [{ configuration: { serviceId: "svc-1", renewalMonths: 12 } }],
      })
    ).toBe(true);
  });

  it("returns false when renewalMonths is missing", () => {
    expect(
      isRenewalOrder({
        serviceId: "svc-1",
        items: [{ configuration: { serviceId: "svc-1" } }],
      })
    ).toBe(false);
  });

  it("returns false when serviceId is missing", () => {
    expect(
      isRenewalOrder({
        serviceId: null,
        items: [{ configuration: { renewalMonths: 12 } }],
      })
    ).toBe(false);
  });
});