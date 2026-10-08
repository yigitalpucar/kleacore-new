import type { Metadata } from "next";
import { getProductsBySubType } from "@/lib/dal/products";
import { Content } from "./content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "IPv4 Blok ve ASN Kiralama",
  description:
    "RIPE kayıtlı /29'dan /26'ya IPv4 blokları ve ASN kiralama. PTR ve abuse yönetimi, BGP session desteği. Fiyatlar KDV hariç, aylık.",
  alternates: { canonical: "/veri-merkezi/ip-asn" },
  openGraph: {
    title: "IPv4 Blok ve ASN Kiralama | KLEACORE",
    description: "RIPE kayıtlı IPv4 blokları ve ASN kiralama; PTR yönetimi, BGP session desteği ve LOA belgesi.",
    url: "/veri-merkezi/ip-asn",
  },
};

export default async function Page() {
  const products = await getProductsBySubType("datacenter", "ip-asn");
  return <Content products={products} />;
}
