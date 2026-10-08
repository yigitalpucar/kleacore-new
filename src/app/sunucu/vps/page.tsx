import type { Metadata } from "next";
import { getServerCatalog, summarizeCatalog } from "@/components/site/sunucu/server-catalog";
import { Content } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "VPS Sunucu Kiralama",
  description:
    "SSD diskli, İstanbul lokasyonlu ekonomik VPS sunucu paketleri. Tam root erişimi, ücretsiz kurulum, aylık veya yıllık ödeme. Fiyatlar KDV hariç.",
  alternates: { canonical: "/sunucu/vps" },
  openGraph: {
    title: "VPS Sunucu Kiralama | KLEACORE",
    description: "Ekonomik VPS sunucular: SSD disk, İstanbul lokasyon ve tam root erişimi. Fiyatlar açıkça listelenir.",
    url: "/sunucu/vps",
  },
};

export default async function Page() {
  const catalog = await getServerCatalog();
  return <Content products={catalog.vps} summaries={summarizeCatalog(catalog)} />;
}
