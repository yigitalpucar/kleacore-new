/**
 * Customer-facing messages for the cart quote (src/lib/actions/customer/cart-quote.ts).
 * checkoutCart keeps its single generic promo message; the cart explains why.
 */

const PROMO_MESSAGES: Record<string, string> = {
  PROMO_NOT_FOUND: "Bu kupon kodu bulunamadı veya artık geçerli değil.",
  PROMO_EXPIRED: "Bu kupon şu anda geçerli değil; kullanım tarihleri dışında.",
  PROMO_USAGE_LIMIT: "Bu kuponun kullanım limiti dolmuş.",
  PROMO_CUSTOMER_LIMIT: "Bu kuponu kullanma hakkınız kalmadı.",
  PROMO_FIRST_ORDER_ONLY: "Bu kupon yalnızca ilk siparişte geçerlidir.",
  PROMO_NOT_APPLICABLE: "Bu kupon sepetinizdeki ürünler için geçerli değil.",
};

export function promoErrorMessage(error: unknown, context: { minOrder?: string } = {}): string {
  const code = error instanceof Error ? error.message : "";
  if (code === "PROMO_MIN_ORDER") {
    return context.minOrder
      ? `Bu kupon en az ${context.minOrder} (KDV hariç) tutarındaki siparişlerde geçerlidir.`
      : "Sepet tutarı bu kupon için yeterli değil.";
  }
  return PROMO_MESSAGES[code] ?? "Kupon şu anda doğrulanamadı. Lütfen tekrar deneyin.";
}

export function quoteLineErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  if (code.startsWith("PRODUCT_NOT_FOUND") || code.startsWith("PRODUCT_SKU_MISSING")) {
    return "Bu ürün artık satışta değil. Sepetten kaldırın.";
  }
  if (code.startsWith("ADDON_NOT_FOUND")) {
    return "Bu ürünün eklentilerinden biri artık satışta değil. Ürünü kaldırıp yeniden ekleyin.";
  }
  if (code.startsWith("CONFIG_INVALID")) {
    const detail = code.split(":").slice(1).join(":").trim();
    return detail || "Ürün yapılandırması geçersiz.";
  }
  if (code.startsWith("DOMAIN_TLD_NOT_FOUND")) {
    return "Bu alan adı uzantısı satışta değil.";
  }
  return "Bu ürünün fiyatı şu anda alınamadı.";
}
