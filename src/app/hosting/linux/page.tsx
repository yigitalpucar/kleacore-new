import type { Metadata } from "next";
import { getProductsBySubType } from "@/lib/dal/products";
import { buildHostingPageData, startingPricesBySubType } from "@/components/site/hosting/data";
import { Content } from "./content";

export const dynamic = "force-dynamic";

const description =
  "cPanel ve LiteSpeed web sunucu ile Linux hosting paketleri. Ücretsiz Let's Encrypt SSL, otomatik yedekleme, İstanbul lokasyon ve 7/24 destek.";

export const metadata: Metadata = {
  title: "Linux Hosting Paketleri",
  description,
  alternates: { canonical: "/hosting/linux" },
  openGraph: { title: "Linux Hosting Paketleri | KLEACORE", description, url: "/hosting/linux" },
};

export default async function Page() {
  const [products, allHosting] = await Promise.all([
    getProductsBySubType("hosting", "linux"),
    getProductsBySubType("hosting"),
  ]);
  const data = buildHostingPageData(products);
  return <Content {...data} startingPrices={startingPricesBySubType(allHosting)} />;
}
