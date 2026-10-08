/** Turkish IBAN: "TR" + 2 check digits + 5-digit bank code + reserve digit + 16-digit account. */
const TR_IBAN_PATTERN = /^TR\d{24}$/;

export function normalizeIban(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

/** ISO 13616 mod-97 check over the rearranged, letter-expanded IBAN. */
export function ibanChecksumValid(iban: string): boolean {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const char of rearranged) {
    const code = char.charCodeAt(0);
    const digits = code >= 65 && code <= 90 ? String(code - 55) : char;
    for (const digit of digits) {
      if (digit < "0" || digit > "9") return false;
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  return remainder === 1;
}

export type IbanValidation = { ok: true; iban: string } | { ok: false; error: string };

export function validateTrIban(value: string): IbanValidation {
  const iban = normalizeIban(value);
  if (!TR_IBAN_PATTERN.test(iban)) {
    return { ok: false, error: "IBAN TR ile başlamalı ve 26 karakter olmalı" };
  }
  if (!ibanChecksumValid(iban)) {
    return { ok: false, error: "IBAN kontrol basamakları hatalı" };
  }
  return { ok: true, iban };
}

/** "TR33 0006 1005 1978 6457 8413 26" */
export function formatIban(iban: string): string {
  return normalizeIban(iban).replace(/(.{4})/g, "$1 ").trim();
}
