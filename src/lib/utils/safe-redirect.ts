const DEFAULT_REDIRECT = "/";

const ALLOWED_CHECKOUT_HOSTS = new Set([
  "checkout.stripe.com",
  "sandbox-cpp.iyzipay.com",
  "cpp.iyzipay.com",
  "merchant.iyzipay.com",
  "www.iyzico.com",
]);

export function getSafeRedirectPath(
  redirectParam: string | null | undefined,
  fallback = DEFAULT_REDIRECT
) {
  if (!redirectParam) {
    return fallback;
  }

  if (redirectParam.startsWith("/") && !redirectParam.startsWith("//")) {
    return redirectParam;
  }

  return fallback;
}

/**
 * Gateway-hosted checkout pages, or our own card form (Kuveyt Türk) when the
 * URL has the current page's origin.
 */
export function isAllowedCheckoutUrl(url: string, currentOrigin?: string): boolean {
  try {
    const parsed = new URL(url);
    if (currentOrigin && parsed.origin === currentOrigin && parsed.pathname.startsWith("/odeme/")) {
      return true;
    }
    if (parsed.protocol !== "https:") {
      return false;
    }

    return ALLOWED_CHECKOUT_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function redirectToCheckoutUrl(url: string): boolean {
  if (!isAllowedCheckoutUrl(url, window.location.origin)) {
    return false;
  }

  window.location.href = url;
  return true;
}