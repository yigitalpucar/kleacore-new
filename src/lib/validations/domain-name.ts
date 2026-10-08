/**
 * Domain name rules shared by the cart (client), checkout (server) and
 * payment fulfilment, so a name that passes checkout never fails provisioning.
 * Pure functions, safe in client components.
 */

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const TLD_LABEL = /^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;
const FORBIDDEN = /[\s/\\:@?#]/;

/**
 * Lower-cases, trims, drops a trailing dot and converts an IDN
 * ("şirket.com.tr") to its ASCII (punycode) form. Returns "" for input that
 * can't be a host name at all (spaces, URL parts).
 */
export function normalizeDomainName(raw: string | null | undefined): string {
  const value = (raw ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (!value || FORBIDDEN.test(value)) {
    return "";
  }

  const wildcard = value.startsWith("*.");
  const host = wildcard ? value.slice(2) : value;
  if (/^[\x00-\x7f]*$/.test(host)) {
    return value;
  }

  try {
    const ascii = new URL(`http://${host}`).hostname;
    return wildcard ? `*.${ascii}` : ascii;
  } catch {
    return "";
  }
}

/** Syntactically valid fully qualified host name (at least name + TLD). */
export function isValidDomainName(name: string, options: { allowWildcard?: boolean } = {}): boolean {
  let host = name;
  if (host.startsWith("*.")) {
    if (!options.allowWildcard) return false;
    host = host.slice(2);
  }

  if (!host || host.length > 253) return false;
  const labels = host.split(".");
  if (labels.length < 2) return false;
  const tld = labels[labels.length - 1];
  return labels.every((label) => LABEL.test(label)) && TLD_LABEL.test(tld);
}

export type DomainNameCheck =
  | { ok: true; domain: string }
  | { ok: false; reason: "DOMAIN_REQUIRED" | "DOMAIN_INVALID"; message: string };

/** Normalises and validates a host name; `message` is Turkish, for the customer. */
export function checkDomainName(
  raw: string | null | undefined,
  options: { allowWildcard?: boolean } = {}
): DomainNameCheck {
  if (!(raw ?? "").trim()) {
    return { ok: false, reason: "DOMAIN_REQUIRED", message: "Alan adı girilmedi" };
  }

  const domain = normalizeDomainName(raw);
  if (!domain || !isValidDomainName(domain, options)) {
    return {
      ok: false,
      reason: "DOMAIN_INVALID",
      message: `Geçersiz alan adı: ${(raw ?? "").trim()}`,
    };
  }

  return { ok: true, domain };
}

/**
 * Splits a registrable domain into its name and one of the sold extensions
 * (longest match, so "ornek.com.tr" is "ornek" + ".com.tr"). Null when the
 * extension isn't sold or the name has extra labels ("www.ornek.com").
 */
export function splitRegistrableDomain(
  domain: string,
  extensions: string[]
): { name: string; tld: string } | null {
  const tld = [...extensions]
    .map((ext) => ext.toLowerCase())
    .sort((a, b) => b.length - a.length)
    .find((ext) => domain.endsWith(ext));

  if (!tld) return null;
  const name = domain.slice(0, -tld.length);
  if (!LABEL.test(name)) return null;
  return { name, tld };
}
