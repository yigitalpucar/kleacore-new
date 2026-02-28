export function generateOrderNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(10000 + Math.random() * 90000);
  return `S-${year}-${random}`;
}

export function generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `F-${year}-${random}`;
}

export function generateTicketNumber(): string {
  const random = Math.floor(100000 + Math.random() * 900000);
  return `T-${random}`;
}

export function generateAffiliateCode(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 6);
  const random = Math.floor(100 + Math.random() * 900);
  return `${slug}${random}`;
}
