import { describe, expect, it, vi } from "vitest";
import { createLogger } from "./logger";

describe("createLogger", () => {
  it("writes one JSON line with scope, level and serialized error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    createLogger("payments").error("callback failed", {
      orderId: "o1",
      error: new Error("boom"),
    });

    expect(spy).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(spy.mock.calls[0][0] as string);
    expect(entry).toMatchObject({
      level: "error",
      scope: "payments",
      message: "callback failed",
      orderId: "o1",
      error: { name: "Error", message: "boom" },
    });
    expect(typeof entry.time).toBe("string");
  });

  it("routes info to stdout and survives unserializable context", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    createLogger("cron").info("ran", { circular });

    const entry = JSON.parse(spy.mock.calls[0][0] as string);
    expect(entry).toMatchObject({ level: "info", scope: "cron", message: "ran" });
  });

  it("redacts card data and secrets from message, context and errors", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    createLogger("payments").error("kart 4508 0345 0803 4509 reddedildi", {
      cardNumber: "4508034508034509",
      cvv: "000",
      nested: { CardCVV2: "123", note: "pan=5188961939192544", password: "x", merchantOrderId: "KC1" },
      amountKurus: 123456789012,
      error: new Error("bad card 5188961939192544"),
    });

    const line = spy.mock.calls[0][0] as string;
    expect(line).not.toMatch(/4508034508034509|4508 0345 0803 4509|5188961939192544/);
    const entry = JSON.parse(line);
    expect(entry.message).toBe("kart [KART ****4509] reddedildi");
    expect(entry.cardNumber).toBe("[REDACTED]");
    expect(entry.cvv).toBe("[REDACTED]");
    expect(entry.nested).toEqual({
      CardCVV2: "[REDACTED]",
      note: "pan=[KART ****2544]",
      password: "[REDACTED]",
      merchantOrderId: "KC1",
    });
    // Non-Luhn numbers (amounts, ids) are left alone.
    expect(entry.amountKurus).toBe(123456789012);
    expect(entry.error.message).toBe("bad card [KART ****2544]");
  });

  it("redacts cPanel single sign-on tokens", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const url = "https://whm.test:2083/cpsess4567890123/login/?session=ornekcom%3aAbCd%3acreate_user_session%2c0123abcd";
    createLogger("panel").warn(`login ${url}`, { target: url, error: new Error(`failed ${url}`) });

    const line = spy.mock.calls[0][0] as string;
    expect(line).not.toMatch(/4567890123|AbCd|0123abcd/);
    expect(line).toContain("/cpsess[REDACTED]");
    expect(line).toContain("session=[REDACTED]");
    spy.mockRestore();
  });
});
