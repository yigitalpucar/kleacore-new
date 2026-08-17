import { describe, expect, it } from "vitest";
import { parseParasutCredentials } from "./parasut-credentials";

describe("parseParasutCredentials", () => {
  it("parses JSON credentials", () => {
    const credentials = parseParasutCredentials(
      JSON.stringify({
        clientId: "cid",
        clientSecret: "secret",
        username: "user@example.com",
        password: "pass",
        companyId: "12345",
      })
    );

    expect(credentials).toEqual({
      clientId: "cid",
      clientSecret: "secret",
      username: "user@example.com",
      password: "pass",
      companyId: "12345",
    });
  });

  it("parses colon-separated credentials", () => {
    const credentials = parseParasutCredentials("cid:secret:user@example.com:pass:12345");

    expect(credentials).toEqual({
      clientId: "cid",
      clientSecret: "secret",
      username: "user@example.com",
      password: "pass",
      companyId: "12345",
    });
  });

  it("returns null for invalid input", () => {
    expect(parseParasutCredentials("")).toBeNull();
    expect(parseParasutCredentials("invalid")).toBeNull();
    expect(parseParasutCredentials("{}")).toBeNull();
  });
});