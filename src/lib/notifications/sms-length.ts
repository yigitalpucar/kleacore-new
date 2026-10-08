/**
 * SMS length / segment count. GSM 03.38 (7-bit) fits 160 characters in one
 * message and 153 per part when concatenated (306 for two). A single
 * character outside the GSM alphabet — Turkish ı, İ, ş, Ş, ğ, Ğ, ç — switches
 * the whole message to UCS-2: 70 in one message, 67 per part (134 for two).
 */

const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXTENDED = "^{}\\[~]|€\f";

const BASIC = new Set([...GSM_BASIC]);
const EXTENDED = new Set([...GSM_EXTENDED]);

export interface SmsLength {
  encoding: "GSM-7" | "UCS-2";
  /** Characters as the operator counts them (GSM extended chars count twice). */
  length: number;
  segments: number;
  /** Limit for the current number of segments (160/306/459… or 70/134/201…). */
  limit: number;
  /** Characters that forced UCS-2. */
  unicodeChars: string[];
}

export function smsLength(text: string): SmsLength {
  const chars = [...text];
  const unicodeChars = [...new Set(chars.filter((char) => !BASIC.has(char) && !EXTENDED.has(char)))];
  if (unicodeChars.length > 0) {
    const length = chars.length;
    const segments = length <= 70 ? 1 : Math.ceil(length / 67);
    return { encoding: "UCS-2", length, segments, limit: segments === 1 ? 70 : segments * 67, unicodeChars };
  }
  const length = chars.reduce((total, char) => total + (EXTENDED.has(char) ? 2 : 1), 0);
  const segments = length <= 160 ? 1 : Math.ceil(length / 153);
  return { encoding: "GSM-7", length, segments, limit: segments === 1 ? 160 : segments * 153, unicodeChars: [] };
}
