import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createUnsubscribeToken, oneClickUnsubscribeUrl, unsubscribeUrl, verifyUnsubscribeToken } from "./consent";

describe("unsubscribe link signature", () => {
  const original = process.env.AUTH_SECRET;
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret-for-unsubscribe";
  });
  afterEach(() => {
    process.env.AUTH_SECRET = original;
  });

  it("round-trips the user id", () => {
    const token = createUnsubscribeToken("cmabc123user");
    expect(verifyUnsubscribeToken(token)).toBe("cmabc123user");
  });

  it("rejects a tampered signature", () => {
    const token = createUnsubscribeToken("cmabc123user");
    const [id, sig] = token.split(".");
    const flipped = `${sig.slice(0, -1)}${sig.endsWith("A") ? "B" : "A"}`;
    expect(verifyUnsubscribeToken(`${id}.${flipped}`)).toBeNull();
  });

  it("cannot be re-pointed at another user", () => {
    const [, sig] = createUnsubscribeToken("cmabc123user").split(".");
    const otherId = Buffer.from("cmother456user").toString("base64url");
    expect(verifyUnsubscribeToken(`${otherId}.${sig}`)).toBeNull();
  });

  it("rejects garbage and tokens signed with another secret", () => {
    const token = createUnsubscribeToken("cmabc123user");
    for (const bad of ["", "abc", "a.b.c", ".", `${token}.x`, null, undefined]) {
      expect(verifyUnsubscribeToken(bad)).toBeNull();
    }
    process.env.AUTH_SECRET = "rotated-secret";
    expect(verifyUnsubscribeToken(token)).toBeNull();
  });

  it("builds the page and one-click URLs", () => {
    expect(unsubscribeUrl("u1", "https://kleacore.com")).toMatch(/^https:\/\/kleacore\.com\/abonelik\/iptal\?t=/);
    const oneClick = new URL(oneClickUnsubscribeUrl("u1", "https://kleacore.com"));
    expect(oneClick.pathname).toBe("/api/abonelik/iptal");
    expect(verifyUnsubscribeToken(oneClick.searchParams.get("t"))).toBe("u1");
  });
});
