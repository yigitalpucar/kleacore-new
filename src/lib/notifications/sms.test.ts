import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, getSettingValueMock, getSmsProviderMock } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  getSettingValueMock: vi.fn(),
  getSmsProviderMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique,
    },
  },
}));

vi.mock("@/lib/integrations/settings", () => ({
  getSettingValue: getSettingValueMock,
  isEnabled: (value: string | undefined | null) =>
    ["1", "true", "yes", "on", "active"].includes((value ?? "").toLowerCase()),
}));

vi.mock("@/lib/integrations/sms", () => ({
  getSmsProvider: getSmsProviderMock,
}));

import { sendSmsNotification } from "./sms";

describe("sendSmsNotification", () => {
  beforeEach(() => {
    findUnique.mockReset();
    getSettingValueMock.mockReset();
    getSmsProviderMock.mockReset();
    getSmsProviderMock.mockResolvedValue({
      name: "netgsm",
      sendSms: vi.fn().mockResolvedValue({ sent: true, provider: "netgsm" }),
      healthCheck: vi.fn(),
    });
  });

  it("skips sending when sms_notifications is disabled", async () => {
    getSettingValueMock.mockResolvedValue("false");

    const result = await sendSmsNotification({
      customerId: "cust-1",
      message: "Test mesajı",
    });

    expect(result).toMatchObject({
      sent: false,
      skipped: true,
      reason: "SMS_NOTIFICATIONS_DISABLED",
    });
    expect(findUnique).not.toHaveBeenCalled();
    expect(getSmsProviderMock).not.toHaveBeenCalled();
  });

  it("sends SMS when notifications are enabled and customer has phone", async () => {
    getSettingValueMock.mockResolvedValue("true");
    findUnique.mockResolvedValue({
      id: "cust-1",
      phone: "0532 111 22 33",
    });

    const provider = await getSmsProviderMock();
    const result = await sendSmsNotification({
      customerId: "cust-1",
      message: "Faturanız ödendi: F-2026-0001",
      template: "payment_received",
    });

    expect(result).toMatchObject({ sent: true, provider: "netgsm" });
    expect(provider.sendSms).toHaveBeenCalledWith({
      to: "0532 111 22 33",
      message: "Faturanız ödendi: F-2026-0001",
    });
  });
});