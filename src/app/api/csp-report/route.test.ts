import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

function post(body: string) {
  return POST(new Request("http://localhost/api/csp-report", { method: "POST", body }));
}

describe("POST /api/csp-report", () => {
  it("logs a trimmed violation summary and returns 204", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await post(
      JSON.stringify({
        "csp-report": {
          "document-uri": "https://kleacore.com/odeme/iyzico",
          "violated-directive": "script-src",
          "blocked-uri": "https://evil.example/x.js",
        },
      })
    );

    expect(res.status).toBe(204);
    const entry = JSON.parse(spy.mock.calls[0][0] as string);
    expect(entry).toMatchObject({
      scope: "csp",
      violatedDirective: "script-src",
      blockedUri: "https://evil.example/x.js",
    });
  });

  it("ignores malformed and oversized bodies", async () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await post("not json")).status).toBe(204);
    expect((await post("x".repeat(20_000))).status).toBe(204);
    expect(spy).not.toHaveBeenCalled();
  });
});
