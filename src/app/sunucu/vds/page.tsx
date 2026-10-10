import type { Metadata } from "next";
import { getServerCatalog, summarizeCatalog } from "@/components/site/sunucu/server-catalog";
import { getConfigOptionsByProduct } from "@/lib/dal/products";
import { toVdsPlan } from "@/lib/catalog/vds-configurator";
import { Content } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "VDS Sunucu Kiralama",
  description:
    "NVMe SSD diskli, İstanbul lokasyonlu VDS sunucu paketleri. Tam root erişimi, ücretsiz kurulum, aylık veya yıllık ödeme. Fiyatlar KDV hariç.",
  alternates: { canonical: "/sunucu/vds" },
  openGraph: {
    title: "VDS Sunucu Kiralama | KLEACORE",
    description:
      "NVMe SSD diskli, İstanbul lokasyonlu VDS sunucular. Tam root erişimi ve ücretsiz kurulum; fiyatlar açıkça listelenir.",
    url: "/sunucu/vds",
  },
};

export default async function Page() {
  const catalog = await getServerCatalog();
  const options = await getConfigOptionsByProduct(catalog.vds.map((p) => p.id));
  const plans = catalog.vds.map((p) => toVdsPlan(p, options.get(p.id) ?? []));
  return <Content products={catalog.vds} plans={plans} summaries={summarizeCatalog(catalog)} />;
}
