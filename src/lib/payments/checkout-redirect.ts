import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { redirectToCheckoutUrl } from "@/lib/utils/safe-redirect";

const IYZICO_CHECKOUT_STORAGE_KEY = "kleacore_iyzico_checkout_html";

export interface CreditCardCheckoutData {
  checkoutUrl?: string | null;
  checkoutHtml?: string | null;
  paytrToken?: string | null;
}

export function handleCreditCardCheckoutRedirect(
  data: CreditCardCheckoutData,
  router: AppRouterInstance
) {
  if (data.checkoutUrl) {
    return redirectToCheckoutUrl(data.checkoutUrl);
  }

  if (data.paytrToken) {
    router.push(`/odeme/paytr?token=${encodeURIComponent(data.paytrToken)}`);
    return true;
  }

  if (data.checkoutHtml) {
    sessionStorage.setItem(IYZICO_CHECKOUT_STORAGE_KEY, data.checkoutHtml);
    router.push("/odeme/iyzico");
    return true;
  }

  return false;
}

export function readStoredIyzicoCheckoutHtml() {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(IYZICO_CHECKOUT_STORAGE_KEY);
}

export function clearStoredIyzicoCheckoutHtml() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(IYZICO_CHECKOUT_STORAGE_KEY);
}