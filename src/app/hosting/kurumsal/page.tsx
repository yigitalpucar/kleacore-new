import type { Metadata } from "next";
import { getProductsBySubType } from "@/lib/dal/products";
import { buildHostingPageData, startingPricesBySubType } from "@/components/site/hosting/data";
import { Content } from "./content";

export const dynamic = "force-dynamic";

const description =
  "İşletmeler için kurumsal hosting: daha yüksek CPU/RAM, Wildcard SSL, günlük yedekleme, kurumsal e-posta ve cPanel. İstanbul lokasyon.";

export const metadata: Metadata = {
  title: "Kurumsal Hosting Paketleri",
  description,
  alternates: { canonical: "/hosting/kurumsal" },
  openGraph: { title: "Kurumsal Hosting Paketleri | KLEACORE", description, url: "/hosting/kurumsal" },
};

export default async function Page() {
  const [products, allHosting] = await Promise.all([
    getProductsBySubType("hosting", "kurumsal"),
    getProductsBySubType("hosting"),
  ]);
  const data = buildHostingPageData(products);
  return <Content {...data} startingPrices={startingPricesBySubType(allHosting)} />;
}
