import {
  checkDomainName,
  splitRegistrableDomain,
} from "@/lib/validations/domain-name";

/**
 * Cart rules that must hold before a customer can pay, so a paid order never
 * fails provisioning for missing or malformed data. Pure: the cart page runs
 * it for inline errors, checkoutCart runs it again on the server (with the
 * sold TLDs) before anything is written.
 */

export interface CartItemForValidation {
  id: string;
  type: string;
  metadata?: {
    domain?: string;
    subType?: string;
    planCode?: string;
    domainChoice?: { type?: string; domain?: string };
  };
}

export interface CartValidationError {
  itemId: string;
  code:
    | "DOMAIN_REQUIRED"
    | "DOMAIN_INVALID"
    | "DOMAIN_TLD_NOT_SUPPORTED"
    | "HOSTING_DOMAIN_CHOICE_INVALID"
    | "HOSTING_NEW_DOMAIN_NOT_IN_CART";
  message: string;
}

export interface CartValidationOptions {
  /** Sold extensions (".com", ".com.tr"); the TLD check is skipped when omitted. */
  tlds?: string[];
  /** Whether an SSL product accepts "*.example.com" (wildcard certificates). */
  sslAllowsWildcard?: (item: CartItemForValidation) => boolean;
}

/** Domain name of a domain cart item ("domain:ornek.com" ids carry it too). */
export function cartDomainItemName(item: CartItemForValidation) {
  return item.metadata?.domain?.trim() || item.id.replace(/^domain:/, "").trim();
}

export function defaultSslAllowsWildcard(item: CartItemForValidation) {
  return (
    item.metadata?.subType === "wildcard" || /(^|-)WC(-|$)/i.test(item.metadata?.planCode ?? "")
  );
}

export function validateCartItems(
  items: CartItemForValidation[],
  options: CartValidationOptions = {}
): CartValidationError[] {
  const errors: CartValidationError[] = [];
  const allowsWildcard = options.sslAllowsWildcard ?? defaultSslAllowsWildcard;

  const cartDomains = new Set(
    items
      .filter((item) => item.type === "domain")
      .map((item) => {
        const check = checkDomainName(cartDomainItemName(item));
        return check.ok ? check.domain : null;
      })
      .filter((domain): domain is string => Boolean(domain))
  );

  for (const item of items) {
    if (item.type === "domain") {
      const raw = cartDomainItemName(item);
      const check = checkDomainName(raw);
      if (!check.ok) {
        errors.push({ itemId: item.id, code: check.reason, message: check.message });
        continue;
      }
      if (options.tlds && !splitRegistrableDomain(check.domain, options.tlds)) {
        errors.push({
          itemId: item.id,
          code: "DOMAIN_TLD_NOT_SUPPORTED",
          message: `${check.domain} için kayıt yapılamıyor: uzantı satışta değil veya alan adı alt alan adı içeriyor`,
        });
      }
      continue;
    }

    if (item.type === "ssl") {
      const check = checkDomainName(item.metadata?.domain, { allowWildcard: allowsWildcard(item) });
      if (!check.ok) {
        errors.push({
          itemId: item.id,
          code: check.reason,
          message:
            check.reason === "DOMAIN_REQUIRED"
              ? "SSL sertifikası için alan adı girin"
              : `SSL sertifikası için alan adı geçersiz: ${(item.metadata?.domain ?? "").trim()}`,
        });
      }
      continue;
    }

    if (item.type === "hosting") {
      const choice = item.metadata?.domainChoice;
      // No choice (plain "add hosting") is the same as "later": the domain is
      // set on the service afterwards.
      if (!choice || choice.type === "later") {
        continue;
      }
      if (choice.type !== "new" && choice.type !== "existing") {
        errors.push({
          itemId: item.id,
          code: "HOSTING_DOMAIN_CHOICE_INVALID",
          message: "Hosting için alan adı seçimi geçersiz",
        });
        continue;
      }

      const check = checkDomainName(choice.domain);
      if (!check.ok) {
        errors.push({
          itemId: item.id,
          code: check.reason,
          message:
            check.reason === "DOMAIN_REQUIRED"
              ? choice.type === "existing"
                ? "Hosting için kullanacağınız alan adını girin (Kendi alan adım)"
                : "Hosting için kaydedilecek alan adını seçin"
              : `Hosting alan adı geçersiz: ${choice.domain}`,
        });
        continue;
      }

      if (choice.type === "new" && !cartDomains.has(check.domain)) {
        errors.push({
          itemId: item.id,
          code: "HOSTING_NEW_DOMAIN_NOT_IN_CART",
          message: `${check.domain} alan adı sepette yok. Alan adını sepete ekleyin veya "Kendi alan adım" seçeneğini kullanın`,
        });
      }
    }
  }

  return errors;
}
