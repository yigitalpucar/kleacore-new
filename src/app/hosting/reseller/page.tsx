import type { Metadata } from "next";
import { getProductsBySubType } from "@/lib/dal/products";
import { buildHostingPageData, startingPricesBySubType } from "@/components/site/hosting/data";
import type { ResellerCalcPlan } from "@/components/site/hosting/reseller-calculator";
import { Content } from "./content";

export const dynamic = "force-dynamic";

const description =
  "WHM paneli ve white label ile reseller hosting. Kendi müşterilerinize cPanel hesabı açın, fiyatınızı siz belirleyin. Günlük yedek.";

export const metadata: Metadata = {
  title: "Reseller Hosting (Bayi Hosting)",
  description,
  alternates: { canonical: "/hosting/reseller" },
  openGraph: { title: "Reseller Hosting (Bayi Hosting) | KLEACORE", description, url: "/hosting/reseller" },
};

export default async function Page() {
  const [products, allHosting] = await Promise.all([
    getProductsBySubType("hosting", "reseller"),
    getProductsBySubType("hosting"),
  ]);
  const data = buildHostingPageData(products);
  const calcPlans: ResellerCalcPlan[] = data.plans.map((plan) => {
    const accounts = plan.specs?.find((spec) => /cpanel/i.test(spec.label))?.value ?? "";
    const match = accounts.match(/\d+/);
    return {
      id: plan.id,
      name: plan.name,
      monthlyPrice: plan.monthlyPrice,
      accountLimit: match ? Number(match[0]) : null,
    };
  });
  return (
    <Content {...data} calcPlans={calcPlans} startingPrices={startingPricesBySubType(allHosting)} />
  );
}
