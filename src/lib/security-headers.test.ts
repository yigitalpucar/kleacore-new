import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy, securityHeaders } from "./security-headers.mjs";

function header(key: string, dev = false) {
  return securityHeaders({ dev }).find((h) => h.key === key)?.value;
}

describe("securityHeaders", () => {
  it("sets the baseline hardening headers", () => {
    expect(header("Strict-Transport-Security")).toMatch(/max-age=\d+/);
    expect(header("X-Content-Type-Options")).toBe("nosniff");
    expect(header("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(header("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(header("Permissions-Policy")).toContain("camera=()");
  });

  it("enforces only non-breaking CSP directives and reports the full policy", () => {
    expect(header("Content-Security-Policy")).toBe(
      "frame-ancestors 'self'; base-uri 'self'; object-src 'none'"
    );
    const reportOnly = header("Content-Security-Policy-Report-Only");
    expect(reportOnly).toContain("report-uri /api/csp-report");
    expect(reportOnly).toContain("default-src 'self'");
  });
});

describe("buildContentSecurityPolicy", () => {
  it("allows the payment providers' scripts and frames", () => {
    const csp = buildContentSecurityPolicy();
    const directive = (name: string) =>
      csp.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";

    expect(directive("script-src")).toContain("https://*.iyzipay.com");
    expect(directive("script-src")).toContain("https://www.paytr.com");
    expect(directive("frame-src")).toContain("https://www.paytr.com");
    expect(directive("frame-src")).toContain("https://*.iyzipay.com");
    expect(directive("object-src")).toBe("object-src 'none'");
  });

  it("allows the Cloudflare Turnstile script and challenge iframe", () => {
    const csp = buildContentSecurityPolicy();
    const directive = (name: string) =>
      csp.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";

    expect(directive("script-src")).toContain("https://challenges.cloudflare.com");
    expect(directive("frame-src")).toContain("https://challenges.cloudflare.com");
  });

  it("only allows eval and websockets in development", () => {
    expect(buildContentSecurityPolicy()).not.toContain("'unsafe-eval'");
    expect(buildContentSecurityPolicy({ dev: true })).toContain("'unsafe-eval'");
    expect(buildContentSecurityPolicy({ dev: true })).toContain("ws:");
  });
});
