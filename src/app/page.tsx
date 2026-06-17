import { Topbar } from "@/components/layout/topbar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { HeroSlider } from "@/components/sections/hero-slider";
import { HostingSolutions } from "@/components/sections/hosting-solutions";
import { DomainSearchSection } from "@/components/sections/domain-search-section";
import { getProductsBySubType } from "@/lib/dal/products";
import { getDomainTlds } from "@/lib/dal/domain-tlds";
import {
  mapProductToHostingPlan,
  mapProductToServerPlan,
} from "@/lib/products/map-product";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [linuxProducts, vdsProducts, tlds] = await Promise.all([
    getProductsBySubType("hosting", "linux"),
    getProductsBySubType("vds"),
    getDomainTlds(),
  ]);

  const linuxPlans = linuxProducts.slice(0, 4).map((product) => {
    const plan = mapProductToHostingPlan(product);
    return { ...plan, detailedFeatures: undefined };
  });
  const vdsPlans = vdsProducts.slice(0, 4).map(mapProductToServerPlan);
  const featuredTlds = tlds.slice(0, 8).map((tld) => ({
    ext: tld.ext,
    price: tld.registerPrice,
    renewPrice: tld.renewPrice,
  }));

  return (
    <div className="flex min-h-screen flex-col">
      <Topbar />
      <Header />
      <main className="flex-1">
        <HeroSlider />
        <DomainSearchSection tlds={featuredTlds} />
        <HostingSolutions linuxPlans={linuxPlans} vdsPlans={vdsPlans} />
      </main>
      <Footer />
    </div>
  );
}