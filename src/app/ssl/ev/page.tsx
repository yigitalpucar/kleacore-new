import type { Metadata } from "next";
import { getProductsBySubType } from "@/lib/dal/products";
import { productToSslPlan } from "@/components/site/domain/ssl-plan";
import { Content } from "./content";

export const dynamic = "force-dynamic";

const description =
  "Kapsamlı kurum doğrulamalı EV SSL sertifikaları. Doğrulama süreci, garanti ve yıllık fiyatlar; fiyatlar KDV hariçtir.";

export const metadata: Metadata = {
  title: "EV SSL Sertifikaları",
  description,
  alternates: { canonical: "/ssl/ev" },
  openGraph: { title: "EV SSL Sertifikaları | KLEACORE", description, url: "/ssl/ev" },
};

const Page = async () => {
  const products = await getProductsBySubType("ssl", "ev");
  return <Content plans={products.map(productToSslPlan)} />;
};

export default Page;
