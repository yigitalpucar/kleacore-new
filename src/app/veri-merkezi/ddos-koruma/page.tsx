import type { Metadata } from "next";
import { getProductsBySubType } from "@/lib/dal/products";
import { Content } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "DDoS Koruma",
  description:
    "Layer 3-4 ve Layer 7 DDoS koruma paketleri. Otomatik algılama, gerçek zamanlı izleme ve raporlama. Fiyatlar KDV hariç, aylık.",
  alternates: { canonical: "/veri-merkezi/ddos-koruma" },
  openGraph: {
    title: "DDoS Koruma | KLEACORE",
    description: "Layer 3-4 ve Layer 7 DDoS koruma paketleri; otomatik algılama ve gerçek zamanlı izleme.",
    url: "/veri-merkezi/ddos-koruma",
  },
};

export default async function Page() {
  const products = await getProductsBySubType("datacenter", "ddos");
  return <Content products={products} />;
}
