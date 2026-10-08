import { describe, expect, it } from "vitest";
import { timingSafeStringEqual } from "./compare";

describe("timingSafeStringEqual", () => {
  it("matches equal strings and rejects different ones", () => {
    expect(timingSafeStringEqual("abc", "abc")).toBe(true);
    expect(timingSafeStringEqual("abc", "abd")).toBe(false);
    expect(timingSafeStringEqual("abc", "abcd")).toBe(false);
    expect(timingSafeStringEqual("", "")).toBe(true);
  });

  it("rejects missing values", () => {
    expect(timingSafeStringEqual(undefined, "abc")).toBe(false);
    expect(timingSafeStringEqual("abc", null)).toBe(false);
  });
});
