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
});
