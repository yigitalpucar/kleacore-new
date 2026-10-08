import type { Metadata } from "next";
import { getProductsBySubType } from "@/lib/dal/products";
import { Content } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CDN Hizmeti",
  description:
    "Statik içeriklerinizi CDN ile önbelleğe alın, sitenizi hızlandırın. SSL dahil paketler, aylık trafik kotası ve analitik. Fiyatlar KDV hariç.",
  alternates: { canonical: "/veri-merkezi/cdn" },
  openGraph: {
    title: "CDN Hizmeti | KLEACORE",
    description: "CDN paketleri: SSL dahil, aylık trafik kotası, DDoS koruması ve gerçek zamanlı analitik.",
    url: "/veri-merkezi/cdn",
  },
};

export default async function Page() {
  const products = await getProductsBySubType("datacenter", "cdn");
  return <Content products={products} />;
}
