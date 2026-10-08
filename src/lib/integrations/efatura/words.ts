/** Turkish amount-in-words for the "Yalnız: …" invoice note. */

const ONES = ["", "Bir", "İki", "Üç", "Dört", "Beş", "Altı", "Yedi", "Sekiz", "Dokuz"];
const TENS = ["", "On", "Yirmi", "Otuz", "Kırk", "Elli", "Altmış", "Yetmiş", "Seksen", "Doksan"];
const GROUPS = ["", "Bin", "Milyon", "Milyar", "Trilyon"];

function threeDigits(n: number): string[] {
  const words: string[] = [];
  const hundreds = Math.floor(n / 100);
  const tens = Math.floor((n % 100) / 10);
  const ones = n % 10;
  if (hundreds) {
    if (hundreds > 1) words.push(ONES[hundreds]);
    words.push("Yüz");
  }
  if (tens) words.push(TENS[tens]);
  if (ones) words.push(ONES[ones]);
  return words;
}

export function integerInWords(value: number): string {
  if (value === 0) return "Sıfır";
  const words: string[] = [];
  let rest = Math.floor(Math.abs(value));
  let group = 0;
  const chunks: string[][] = [];
  while (rest > 0 && group < GROUPS.length) {
    const chunk = rest % 1000;
    if (chunk) {
      // "Bin", not "Bir Bin".
      const chunkWords = group === 1 && chunk === 1 ? [] : threeDigits(chunk);
      chunks.unshift([...chunkWords, GROUPS[group]].filter(Boolean));
    }
    rest = Math.floor(rest / 1000);
    group += 1;
  }
  for (const chunk of chunks) words.push(...chunk);
  return words.join(" ");
}

export function amountInWordsTry(kurus: number): string {
  const lira = Math.floor(Math.abs(kurus) / 100);
  const cents = Math.abs(kurus) % 100;
  const text = `${integerInWords(lira)} Türk Lirası`;
  return cents ? `${text} ${integerInWords(cents)} Kuruş` : text;
}
