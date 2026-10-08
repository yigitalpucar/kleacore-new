// Security response headers, shared by next.config.mjs and its tests.
// Plain .mjs so next.config.mjs can import it without a TS loader.

// iyzico's checkout bundle loads from *.iyzipay.com and reports analytics to
// countly.iyzico.com and errors to Sentry (observed with the sandbox form).
const IYZICO = ["https://*.iyzipay.com", "https://*.iyzico.com"];
const IYZICO_TELEMETRY = "https://*.sentry.io";
const PAYTR = "https://www.paytr.com";
const STRIPE_JS = "https://js.stripe.com";
// Kuveyt Türk's 3-D page (served from our origin by /api/payments/kuveytturk/start)
// auto-posts to the bank / BKM 3-D Secure server.
const KUVEYTTURK_3DS = ["https://*.kuveytturk.com.tr", "https://*.bkm.com.tr", "https://*.bkmtest.com.tr"];

/**
 * Full Content-Security-Policy for the app.
 *
 * - script-src needs 'unsafe-inline': Next.js App Router streams inline
 *   bootstrap/flight scripts and the iyzico checkout form is injected as an
 *   inline-script HTML snippet (srcdoc iframes inherit this policy). Moving to
 *   nonces would force every page to render dynamically.
 * - img-src allows https: because blog/product content can reference
 *   arbitrary remote images.
 */
export function buildContentSecurityPolicy({ dev = false, reportUri } = {}) {
  const directives = {
    "default-src": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
    "frame-ancestors": ["'self'"],
    "form-action": ["'self'", ...IYZICO, PAYTR, "https://checkout.stripe.com", ...KUVEYTTURK_3DS],
    "script-src": ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : []), ...IYZICO, PAYTR, STRIPE_JS],
    "style-src": ["'self'", "'unsafe-inline'", ...IYZICO],
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'", "data:", ...IYZICO],
    "connect-src": ["'self'", ...IYZICO, IYZICO_TELEMETRY, ...(dev ? ["ws:"] : [])],
    "frame-src": ["'self'", ...IYZICO, PAYTR, STRIPE_JS],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
  };
  if (reportUri) directives["report-uri"] = [reportUri];

  return Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
}

/**
 * Headers for every route. The full CSP ships as Report-Only: the iyzico
 * checkout (third-party HTML injected into a srcdoc iframe, then 3-D Secure
 * bank pages) can't be exercised end-to-end locally, and a wrong enforced
 * policy would silently break payments. Violations are reported to
 * /api/csp-report (logged as JSON) so the policy can be enforced once the
 * production logs are clean. The enforced CSP only carries the directives
 * that cannot break third-party content.
 */
export function securityHeaders({ dev = false } = {}) {
  return [
    { key: "Strict-Transport-Security", value: "max-age=31536000" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "SAMEORIGIN" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), usb=(), browsing-topics=()",
    },
    {
      key: "Content-Security-Policy",
      value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'",
    },
    {
      key: "Content-Security-Policy-Report-Only",
      value: buildContentSecurityPolicy({ dev, reportUri: "/api/csp-report" }),
    },
  ];
}
