import { createHash } from "node:crypto";

/**
 * Coarse device fingerprint for sign-in notices and trusted devices:
 * browser family + OS family (never the version: browsers update weekly) and
 * the network — the CDN country when the request carries one, otherwise the
 * IPv4 /24 or IPv6 /48 prefix. Deliberately coarse: a stable laptop on the
 * same connection is "known", a new browser or a new network is "new".
 */

const BROWSERS: Array<[RegExp, string]> = [
  [/\bEdg(?:e|A|iOS)?\//, "Edge"],
  [/\bOPR\/|\bOpera\b/, "Opera"],
  [/\bYaBrowser\//, "Yandex"],
  [/\bSamsungBrowser\//, "Samsung Internet"],
  [/\bFirefox\/|\bFxiOS\//, "Firefox"],
  [/\bChrome\/|\bCriOS\/|\bChromium\//, "Chrome"],
  [/\bSafari\//, "Safari"],
];

const SYSTEMS: Array<[RegExp, string]> = [
  [/\biPhone\b|\biPad\b|\biPod\b/, "iOS"],
  [/\bAndroid\b/, "Android"],
  [/\bWindows\b/, "Windows"],
  [/\bMac OS X\b|\bMacintosh\b/, "macOS"],
  [/\bCrOS\b/, "ChromeOS"],
  [/\bLinux\b/, "Linux"],
];

/** "Chrome · macOS"; "Bilinmeyen tarayıcı" for empty or unrecognised agents. */
export function userAgentFamily(userAgent: string | null | undefined): string {
  const ua = userAgent?.trim() ?? "";
  if (!ua) return "Bilinmeyen tarayıcı";
  const browser = BROWSERS.find(([pattern]) => pattern.test(ua))?.[1];
  const system = SYSTEMS.find(([pattern]) => pattern.test(ua))?.[1];
  if (!browser && !system) return /bot|crawler|spider|curl|wget|python|node/i.test(ua) ? "Otomatik istemci" : "Bilinmeyen tarayıcı";
  return [browser ?? "Tarayıcı", system].filter(Boolean).join(" · ");
}

/** IPv4 → "203.0.113.0/24", IPv6 → "2001:db8:1::/48", otherwise null. */
export function ipNetwork(ip: string | null | undefined): string | null {
  const value = ip?.trim();
  if (!value) return null;
  const v4 = value.replace(/^::ffff:/i, "");
  const parts = v4.split(".");
  if (parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255)) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }
  if (value.includes(":")) {
    const [head] = value.split("::");
    const groups = (head ?? "").split(":").filter(Boolean);
    const full = value.includes("::") ? groups : value.split(":");
    const prefix = full.slice(0, 3).map((g) => g.toLowerCase().replace(/^0+(?=.)/, ""));
    while (prefix.length < 3) prefix.push("0");
    return `${prefix.join(":")}::/48`;
  }
  return null;
}

/** Two-letter country from a CDN header (Cloudflare cf-ipcountry); "XX"/"T1" ignored. */
export function countryFromHeaders(headers: Pick<Headers, "get"> | null | undefined): string | null {
  const raw = headers?.get("cf-ipcountry")?.trim().toUpperCase();
  if (!raw || !/^[A-Z]{2}$/.test(raw) || raw === "XX" || raw === "T1") return null;
  return raw;
}

export interface DeviceFingerprint {
  uaFamily: string;
  /** Country code or IP prefix; null when neither is known. */
  network: string | null;
  /** sha256(uaFamily | network) — what "known device" compares. */
  deviceHash: string;
  /** sha256(uaFamily) — what a trusted-device cookie is bound to (networks change). */
  browserHash: string;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function deviceFingerprint(input: {
  userAgent: string | null | undefined;
  ip: string | null | undefined;
  country?: string | null;
}): DeviceFingerprint {
  const uaFamily = userAgentFamily(input.userAgent);
  const network = input.country ? `country:${input.country}` : ipNetwork(input.ip);
  return {
    uaFamily,
    network,
    deviceHash: sha256(`device:${uaFamily}|${network ?? "unknown"}`),
    browserHash: sha256(`browser:${uaFamily}`),
  };
}

/** Display form of a network ("TR", "203.0.113.0/24"). */
export function networkLabel(network: string | null | undefined) {
  if (!network) return null;
  return network.startsWith("country:") ? network.slice("country:".length) : network;
}
