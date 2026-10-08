import type { Metadata } from "next";
import { getProductsBySubType } from "@/lib/dal/products";
import { productToSslPlan } from "@/components/site/domain/ssl-plan";
import { Content } from "./content";

export const dynamic = "force-dynamic";

const description =
  "Ana alan adınızı ve tüm birinci seviye alt alan adlarınızı tek sertifikayla koruyun. DV ve OV wildcard SSL, yıllık fiyatlar KDV hariç.";

export const metadata: Metadata = {
  title: "Wildcard SSL Sertifikaları",
  description,
  alternates: { canonical: "/ssl/wildcard" },
  openGraph: { title: "Wildcard SSL Sertifikaları | KLEACORE", description, url: "/ssl/wildcard" },
};

const Page = async () => {
  const products = await getProductsBySubType("ssl", "wildcard");
  return <Content plans={products.map(productToSslPlan)} />;
};

export default Page;
