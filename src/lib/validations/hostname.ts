/**
 * Server hostname a customer may request for a VDS/VPS order (RFC 1123):
 * a single label ("web01") or a fully qualified name ("web01.ornek.com").
 * Shared by the configurator (live feedback) and checkout (authoritative).
 */
export type HostnameCheck = { ok: true; hostname: string } | { ok: false; error: string };

const LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export const HOSTNAME_MAX_LENGTH = 253;

export function checkHostname(raw: string | null | undefined): HostnameCheck {
  const value = (raw ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (!value) return { ok: false, error: "Sunucu adı girin" };
  if (value.length > HOSTNAME_MAX_LENGTH) {
    return { ok: false, error: `Sunucu adı en fazla ${HOSTNAME_MAX_LENGTH} karakter olabilir` };
  }
  if (/[^a-z0-9.-]/.test(value)) {
    return { ok: false, error: "Yalnızca İngilizce harf, rakam, nokta ve tire kullanın" };
  }

  const labels = value.split(".");
  if (labels.some((label) => label.length === 0)) {
    return { ok: false, error: "Ardışık veya baştaki nokta kullanılamaz" };
  }
  if (labels.some((label) => label.length > 63)) {
    return { ok: false, error: "Noktalar arasındaki her bölüm en fazla 63 karakter olabilir" };
  }
  if (labels.some((label) => !LABEL.test(label))) {
    return { ok: false, error: "Bölümler tire ile başlayamaz veya bitemez" };
  }
  // "203.0.113.10" is an address, not a name.
  if (/^\d+$/.test(labels[labels.length - 1])) {
    return { ok: false, error: "Sunucu adı IP adresi olamaz; son bölüm harf içermeli" };
  }

  return { ok: true, hostname: value };
}
