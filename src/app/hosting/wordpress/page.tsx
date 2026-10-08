import type { Metadata } from "next";
import { getProductsBySubType } from "@/lib/dal/products";
import { buildHostingPageData, startingPricesBySubType } from "@/components/site/hosting/data";
import { Content } from "./content";

export const dynamic = "force-dynamic";

const description =
  "LiteSpeed Cache ve WP Staging ile WordPress hosting. Günlük otomatik yedek, ücretsiz SSL, cPanel ve İstanbul lokasyon. Fiyatlar KDV hariç.";

export const metadata: Metadata = {
  title: "WordPress Hosting Paketleri",
  description,
  alternates: { canonical: "/hosting/wordpress" },
  openGraph: { title: "WordPress Hosting Paketleri | KLEACORE", description, url: "/hosting/wordpress" },
};

export default async function Page() {
  const [products, allHosting] = await Promise.all([
    getProductsBySubType("hosting", "wordpress"),
    getProductsBySubType("hosting"),
  ]);
  const data = buildHostingPageData(products);
  return <Content {...data} startingPrices={startingPricesBySubType(allHosting)} />;
}
