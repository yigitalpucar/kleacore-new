import type { Metadata } from "next";
import { getProductsBySubType } from "@/lib/dal/products";
import { productToSslPlan } from "@/components/site/domain/ssl-plan";
import { Content } from "./content";

export const dynamic = "force-dynamic";

const description =
  "Çok sayıda SSL sertifikasına ihtiyaç duyan kurumlar için ihtiyaca göre teklif. DV, OV, EV ve wildcard sertifikalar tek elden.";

export const metadata: Metadata = {
  title: "Kurumsal SSL Çözümleri",
  description,
  alternates: { canonical: "/ssl/kurumsal" },
  openGraph: { title: "Kurumsal SSL Çözümleri | KLEACORE", description, url: "/ssl/kurumsal" },
};

const Page = async () => {
  const products = await getProductsBySubType("ssl", "kurumsal");
  return <Content plans={products.map(productToSslPlan)} />;
};

export default Page;
