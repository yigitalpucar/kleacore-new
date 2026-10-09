import { describe, expect, it } from "vitest";
import { ADMIN_ALERT_EVENTS, buildAdminAlert } from "./admin-alert";
import type { DispatchedEvent } from "./types";

describe("admin alert: order held for KYC", () => {
  it("alerts staff when a paid order waits for identity verification", () => {
    expect(ADMIN_ALERT_EVENTS).toContain("kyc.required");
    const alert = buildAdminAlert({
      id: "evt-1",
      type: "kyc.required",
      payload: { userId: "cus-1", orderId: "ord-1", orderNumber: "S-2026-000123", productName: "VDS M" },
    } as unknown as DispatchedEvent);
    expect(alert).toMatchObject({
      title: "Kimlik doğrulaması bekleniyor: S-2026-000123",
      path: "/yonetim/siparisler/ord-1",
    });
    expect(alert?.message).toContain("VDS M");
  });
});
