import type { FaqItem } from "@/components/site/faq-section";
import type { PlanCardData } from "@/components/site/plan-card";
import { productToPlanCard, type ProductWithPricing } from "@/lib/products/map-product";
import { isUnverifiedClaim } from "./server-catalog";

/** DB datacenter product -> card data (specs from `features`, checklist from `includedFeatures`). */
export function productToDcCard(p: ProductWithPricing): PlanCardData {
  const card = productToPlanCard(p, { href: "/sepet" });
  const specValues = (card.specs ?? [])
    .map((s) => s.value.split("/")[0].trim().toLocaleLowerCase("tr"))
    .filter((v) => v.length >= 2);
  const included = ((p.includedFeatures as unknown as string[] | null) ?? []).filter((f) => {
    const lower = f.toLocaleLowerCase("tr");
    return !isUnverifiedClaim(f) && !specValues.some((v) => lower.includes(v));
  });
  // Card badges: DB isPopular wins; otherwise the DB badge in sentence case.
  const badge = card.badge
    ? card.badge.charAt(0) + card.badge.slice(1).toLocaleLowerCase("tr")
    : undefined;
  return { ...card, badge, features: included };
}

/** FAQ stored on the first product that has one; SLA / uptime claims are left out. */
export function dcFaqs(products: ProductWithPricing[]): FaqItem[] {
  const withFaq = products.find((p) => Array.isArray(p.faq) && (p.faq as unknown[]).length > 0);
  const items = ((withFaq?.faq as unknown as FaqItem[] | undefined) ?? []).filter(
    (f) => f?.question && f?.answer && !isUnverifiedClaim(`${f.question} ${f.answer}`)
  );
  return [
    ...items,
    {
      question: "Fiyatlara KDV dahil mi?",
      answer: "Hayır. Gösterilen fiyatlara KDV dahil değildir; %20 KDV ödeme adımında eklenir.",
    },
  ];
}
