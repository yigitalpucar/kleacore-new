import type { Metadata } from "next";
import { getServerCatalog, summarizeCatalog } from "@/components/site/sunucu/server-catalog";
import { Content } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bulut Sunucu",
  description:
    "AMD EPYC işlemci, DDR5 bellek ve NVMe SSD diskli bulut sunucu paketleri. İstanbul lokasyon, tam root erişimi. Fiyatlar KDV hariç.",
  alternates: { canonical: "/sunucu/bulut" },
  openGraph: {
    title: "Bulut Sunucu | KLEACORE",
    description: "Yüksek kaynaklı bulut sunucular: DDR5 bellek, NVMe SSD, 10 Gbps port ve İstanbul lokasyon.",
    url: "/sunucu/bulut",
  },
};

export default async function Page() {
  const catalog = await getServerCatalog();
  return <Content products={catalog.bulut} summaries={summarizeCatalog(catalog)} />;
}
