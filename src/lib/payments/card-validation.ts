/**
 * Card form validation shared by the payment form (client) and the
 * Kuveyt Türk start route (server). Pure functions: no logging, no storage.
 */

export type CardValidationError = "holder" | "number" | "expiry" | "cvv";

export interface ValidatedCard {
  holderName: string;
  number: string;
  expireMonth: string;
  expireYear: string;
  cvv: string;
}

export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function passesLuhn(cardNumber: string) {
  if (!/^\d{12,19}$/.test(cardNumber)) return false;
  let sum = 0;
  let double = false;
  for (let index = cardNumber.length - 1; index >= 0; index -= 1) {
    let digit = cardNumber.charCodeAt(index) - 48;
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

/** "4111111111111111" → "4111 1111 1111 1111" (Amex-style 4-6-5 for 15 digits). */
export function formatCardNumber(value: string) {
  const digits = digitsOnly(value).slice(0, 19);
  if (digits.length === 15) {
    return [digits.slice(0, 4), digits.slice(4, 10), digits.slice(10)].filter(Boolean).join(" ");
  }
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ");
}

/** Typing mask for "AA/YY". */
export function formatExpiry(value: string) {
  const digits = digitsOnly(value).slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export function parseExpiry(value: string, now = new Date()) {
  const match = /^\s*(\d{1,2})\s*\/\s*(\d{2}|\d{4})\s*$/.exec(value);
  if (!match) return null;
  const month = Number(match[1]);
  const year = match[2].length === 4 ? Number(match[2]) : 2000 + Number(match[2]);
  if (month < 1 || month > 12) return null;
  // Valid through the last day of the expiry month.
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (year < currentYear || (year === currentYear && month < currentMonth)) return null;
  if (year > currentYear + 20) return null;
  return { month: String(month).padStart(2, "0"), year: String(year % 100).padStart(2, "0") };
}

export function validateCard(
  input: { holderName: string; number: string; expiry: string; cvv: string },
  now = new Date()
): { ok: true; card: ValidatedCard } | { ok: false; errors: CardValidationError[] } {
  const errors: CardValidationError[] = [];
  const holderName = input.holderName.replace(/\s+/g, " ").trim();
  const number = digitsOnly(input.number);
  const expiry = parseExpiry(input.expiry, now);
  const cvv = digitsOnly(input.cvv);

  if (holderName.length < 3 || holderName.length > 64 || /\d/.test(holderName)) errors.push("holder");
  if (number.length < 15 || number.length > 19 || !passesLuhn(number)) errors.push("number");
  if (!expiry) errors.push("expiry");
  if (!/^\d{3,4}$/.test(cvv) || cvv.length !== input.cvv.trim().length) errors.push("cvv");

  if (errors.length > 0 || !expiry) return { ok: false, errors };
  return {
    ok: true,
    card: { holderName, number, expireMonth: expiry.month, expireYear: expiry.year, cvv },
  };
}

export const CARD_ERROR_MESSAGES: Record<CardValidationError, string> = {
  holder: "Kart üzerindeki adı ve soyadı girin.",
  number: "Kart numarası geçersiz. Lütfen kontrol edin.",
  expiry: "Son kullanma tarihi geçersiz veya geçmiş (AA/YY).",
  cvv: "Güvenlik kodu (CVV) 3 veya 4 haneli olmalıdır.",
};
