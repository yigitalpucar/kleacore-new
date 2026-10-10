/**
 * Where a customer manages what an order bought, by product category slug
 * (payment result pages link each order to its panel page).
 */
export function servicePanelLink(categorySlug: string | null | undefined): { href: string; label: string } {
  switch (categorySlug) {
    case "domain":
      return { href: "/musteri/panel/domainler", label: "Alan adlarım" };
    case "vps":
    case "vds":
    case "cloud":
    case "server":
      return { href: "/musteri/panel/sunucular", label: "Sunucularım" };
    case "ssl":
      return { href: "/musteri/panel/ssl", label: "SSL sertifikalarım" };
    case "email":
      return { href: "/musteri/panel/e-posta", label: "E-posta hesaplarım" };
    default:
      return { href: "/musteri/panel/hizmetlerim", label: "Hizmetlerim" };
  }
}

/** Retry target after a failed card payment: the invoice itself when there is one. */
export function retryPaymentHref(invoiceIds: string[]): string {
  return invoiceIds.length === 1
    ? `/musteri/panel/faturalar/${encodeURIComponent(invoiceIds[0])}`
    : "/musteri/panel/faturalar";
}

/** Comma-separated invoice ids from the cancel URL, de-duplicated and capped. */
export function parseInvoiceIds(value: string | undefined, max = 50): string[] {
  return Array.from(
    new Set(
      (value ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    )
  ).slice(0, max);
}
