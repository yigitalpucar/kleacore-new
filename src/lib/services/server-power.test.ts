import { describe, expect, it } from "vitest";
import {
  CUSTOMER_STOPPED_REASON,
  POWER_ACTION_COPY,
  customerPowerButtons,
  customerStartBlockReason,
  isCustomerStopped,
  isPowerActionSettled,
} from "./server-power";

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

describe("customerPowerButtons", () => {
  it("offers restart + stop for a running server", () => {
    expect(customerPowerButtons({ status: "ACTIVE" })).toEqual([
      { action: "restart", disabledReason: null },
      { action: "stop", disabledReason: null },
    ]);
  });

  it("offers start for a customer-stopped server and blocks billing suspensions", () => {
    expect(customerPowerButtons({ status: "SUSPENDED", suspendReason: CUSTOMER_STOPPED_REASON })).toEqual([
      { action: "start", disabledReason: null },
    ]);
    expect(customerPowerButtons({ status: "SUSPENDED", suspendReason: "Ödenmemiş fatura" })).toEqual([
      { action: "start", disabledReason: "Askıdaki sunucu, ödeme veya destek sonrası açılır" },
    ]);
  });

  it("disables every button while busy, reinstalling or not ready", () => {
    for (const extra of [{ busy: true }, { reinstallRunning: true }, { ready: false }]) {
      const buttons = customerPowerButtons({ status: "ACTIVE", ...extra });
      expect(buttons.every((b) => b.disabledReason)).toBe(true);
    }
    expect(customerPowerButtons({ status: "SUSPENDED", suspendReason: CUSTOMER_STOPPED_REASON, busy: true })[0].disabledReason).toBe(
      "İşlem sürüyor"
    );
  });
});

describe("power action progress", () => {
  it("settles when the expected power state is reached (or unknown)", () => {
    expect(isPowerActionSettled("stop", { powerState: "running" })).toBe(false);
    expect(isPowerActionSettled("stop", { powerState: "stopped" })).toBe(true);
    expect(isPowerActionSettled("start", { powerState: "running" })).toBe(true);
    expect(isPowerActionSettled("restart", { powerState: "unknown" })).toBe(true);
  });

  it("names the server in every confirmation", () => {
    for (const copy of Object.values(POWER_ACTION_COPY)) expect(copy.confirm("Uygulama sunucusu")).toContain("“Uygulama sunucusu”");
  });
});
