import type { Metadata } from "next";
import { getProductsBySubType } from "@/lib/dal/products";
import { productToSslPlan } from "@/components/site/domain/ssl-plan";
import { Content } from "./content";

export const dynamic = "force-dynamic";

const description =
  "Tek alan adı için DV ve OV SSL sertifikaları. Doğrulama seviyesi, garanti ve yıllık fiyatları karşılaştırın; fiyatlar KDV hariçtir.";

export const metadata: Metadata = {
  title: "Standart SSL Sertifikaları",
  description,
  alternates: { canonical: "/ssl/standart" },
  openGraph: { title: "Standart SSL Sertifikaları | KLEACORE", description, url: "/ssl/standart" },
};

const Page = async () => {
  const products = await getProductsBySubType("ssl", "standart");
  return <Content plans={products.map(productToSslPlan)} />;
};

export default Page;
