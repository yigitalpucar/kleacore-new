import type { Metadata } from "next";
import { getServerCatalog, summarizeCatalog } from "@/components/site/sunucu/server-catalog";
import { Content } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fiziksel Sunucu Kiralama",
  description:
    "Intel Xeon işlemcili, NVMe SSD diskli fiziksel (dedicated) sunucu paketleri. IPMI/KVM erişimi, İstanbul lokasyon. Fiyatlar KDV hariç.",
  alternates: { canonical: "/sunucu/fiziksel" },
  openGraph: {
    title: "Fiziksel Sunucu Kiralama | KLEACORE",
    description: "Size özel donanım: Intel Xeon işlemci, NVMe SSD disk, IPMI/KVM erişimi ve İstanbul lokasyon.",
    url: "/sunucu/fiziksel",
  },
};

export default async function Page() {
  const catalog = await getServerCatalog();
  return <Content products={catalog.fiziksel} summaries={summarizeCatalog(catalog)} />;
}
