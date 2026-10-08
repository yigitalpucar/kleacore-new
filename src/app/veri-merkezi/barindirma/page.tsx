import type { Metadata } from "next";
import { getProductsBySubType } from "@/lib/dal/products";
import { Content } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sunucu Barındırma (Colocation)",
  description:
    "Kendi sunucunuzu İstanbul'daki veri merkezi raf alanında barındırın. 1U'dan yarım kabinete paketler, IPv4 ve port dahil. Fiyatlar KDV hariç.",
  alternates: { canonical: "/veri-merkezi/barindirma" },
  openGraph: {
    title: "Sunucu Barındırma (Colocation) | KLEACORE",
    description: "1U'dan yarım kabinete colocation paketleri; İstanbul lokasyon, IPv4 adresleri ve port dahil.",
    url: "/veri-merkezi/barindirma",
  },
};

export default async function Page() {
  const products = await getProductsBySubType("datacenter", "barindirma");
  return <Content products={products} />;
}
