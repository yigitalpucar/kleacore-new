import { afterEach, describe, expect, it } from "vitest";
import { verifyCronRequest } from "./auth";

function request(headers: Record<string, string>) {
  return new Request("http://localhost/api/cron/test", { headers });
}

describe("verifyCronRequest", () => {
  afterEach(() => {
    delete process.env.CRON_SECRET;
  });

  it("accepts the bearer token or x-cron-secret header", () => {
    process.env.CRON_SECRET = "s3cret";
    expect(verifyCronRequest(request({ authorization: "Bearer s3cret" }))).toBe(true);
    expect(verifyCronRequest(request({ "x-cron-secret": "s3cret" }))).toBe(true);
  });

  it("rejects wrong, partial or missing secrets", () => {
    process.env.CRON_SECRET = "s3cret";
    expect(verifyCronRequest(request({ authorization: "Bearer s3cre" }))).toBe(false);
    expect(verifyCronRequest(request({ "x-cron-secret": "nope" }))).toBe(false);
    expect(verifyCronRequest(request({}))).toBe(false);
  });

  it("rejects everything when no secret is configured", () => {
    expect(verifyCronRequest(request({ authorization: "Bearer " }))).toBe(false);
  });
});
